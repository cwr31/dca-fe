import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fundCode = searchParams.get('code');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!fundCode) {
    return NextResponse.json(
      { error: '请提供基金代码' },
      { status: 400 }
    );
  }

  try {
    // 确定应用根目录：优先使用环境变量，否则使用当前工作目录（本地开发）或 /app（Docker）
    const appRoot = process.env.APP_ROOT || process.cwd();
    const scriptPath = path.join(appRoot, 'scripts', 'get_fund_data.py');
    
    // 验证基金代码格式（防止命令注入）
    if (!/^[0-9]{6}$/.test(fundCode)) {
      return NextResponse.json(
        { error: '基金代码格式不正确，应为6位数字' },
        { status: 400 }
      );
    }
    
    // 验证日期格式（如果提供）
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return NextResponse.json(
        { error: '开始日期格式不正确，应为 YYYY-MM-DD' },
        { status: 400 }
      );
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json(
        { error: '结束日期格式不正确，应为 YYYY-MM-DD' },
        { status: 400 }
      );
    }
    
    // 确定 Python 可执行文件路径
    // 优先使用环境变量，否则根据操作系统和 venv 位置自动检测
    let venvPython = process.env.VENV_PYTHON;
    
    if (!venvPython) {
      // 检测操作系统
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        // Windows: venv/Scripts/python.exe
        venvPython = path.join(appRoot, 'venv', 'Scripts', 'python.exe');
      } else {
        // Linux/Mac: 按优先级尝试不同的路径
        const venvPython3Path = path.join(appRoot, 'venv', 'bin', 'python3');
        const venvPythonPath = path.join(appRoot, 'venv', 'bin', 'python');
        
        // 优先使用 python3，如果不存在则使用 python
        if (existsSync(venvPython3Path)) {
          venvPython = venvPython3Path;
        } else if (existsSync(venvPythonPath)) {
          venvPython = venvPythonPath;
        } else {
          // 如果 venv 中的 Python 不存在，使用系统的 python3
          venvPython = 'python3';
        }
      }
    }
    
    // 构建命令参数（使用数组形式更安全）
    const args = [venvPython, scriptPath, fundCode];
    if (startDate) args.push(startDate);
    if (endDate) args.push(endDate);
    
    // 构建 PATH 环境变量（添加 venv 的 bin/Scripts 目录）
    const isWindows = process.platform === 'win32';
    const venvBinPath = isWindows 
      ? path.join(appRoot, 'venv', 'Scripts')
      : path.join(appRoot, 'venv', 'bin');
    
    // 执行 Python 脚本
    const { stdout, stderr } = await execAsync(args.join(' '), {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 30000, // 30秒超时
      env: { 
        ...process.env, 
        PATH: `${venvBinPath}${isWindows ? ';' : ':'}${process.env.PATH}` 
      }
    });
    
    if (stderr && !stderr.includes('Warning') && !stderr.includes('DeprecationWarning')) {
      console.error('Python 脚本警告:', stderr);
    }
    
    // 解析 JSON 结果
    const result = JSON.parse(stdout.trim());
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '获取基金数据失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    console.error('获取基金数据失败:', error);
    
    // 如果 Python 脚本执行失败，返回友好的错误信息
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes('not found') || errorMessage.includes('ENOENT')) {
      const appRoot = process.env.APP_ROOT || process.cwd();
      const isWindows = process.platform === 'win32';
      const venvPath = isWindows 
        ? path.join(appRoot, 'venv', 'Scripts', 'python.exe')
        : path.join(appRoot, 'venv', 'bin', 'python3');
      
      return NextResponse.json(
        { 
          error: '无法找到 Python 可执行文件。请确保：\n1. 已创建 Python 虚拟环境（python3 -m venv venv）\n2. 已安装依赖（venv/bin/pip install -r requirements.txt）\n3. Python 路径正确',
          details: `尝试的路径: ${venvPath}\n错误: ${errorMessage}`
        },
        { status: 500 }
      );
    }
    
    if (errorMessage.includes('python') || errorMessage.includes('Python')) {
      return NextResponse.json(
        { 
          error: '无法执行 Python 脚本。请确保已安装 Python 3 和 akshare 库（pip install akshare）',
          details: errorMessage
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: errorMessage || '获取基金数据失败，请检查基金代码是否正确',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

