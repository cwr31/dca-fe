import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

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
    // 构建 Python 脚本路径
    const scriptPath = path.join(process.cwd(), 'scripts', 'get_fund_data.py');
    
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
    
    // 使用 venv 环境中的 Python
    const venvPython = process.env.VENV_PYTHON || path.join(process.cwd(), 'venv', 'bin', 'python');
    
    // 构建命令参数（使用数组形式更安全）
    const args = [venvPython, scriptPath, fundCode];
    if (startDate) args.push(startDate);
    if (endDate) args.push(endDate);
    
    // 执行 Python 脚本
    const { stdout, stderr } = await execAsync(args.join(' '), {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 30000, // 30秒超时
      env: { 
        ...process.env, 
        PATH: `${path.join(process.cwd(), 'venv', 'bin')}:${process.env.PATH}` 
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
    if (error.message && error.message.includes('python3')) {
      return NextResponse.json(
        { 
          error: '无法执行 Python 脚本。请确保已安装 Python 3 和 akshare 库（pip install akshare）',
          details: error.message
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: error.message || '获取基金数据失败，请检查基金代码是否正确',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

