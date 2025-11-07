#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
获取基金数据的 Python 脚本
使用 akshare 获取基金净值数据
"""

import sys
import json
import pandas as pd
import akshare as ak

def get_fund_data(fund_code, start_date=None, end_date=None):
    """
    获取基金净值数据
    
    Args:
        fund_code: 基金代码
        start_date: 开始日期 (可选)
        end_date: 结束日期 (可选)
    
    Returns:
        基金净值数据列表
    """
    try:
        df = None
        last_error = None
        
        # 方法1: 尝试获取单位净值走势（通常包含单位净值和累计净值）
        try:
            df = ak.fund.fund_em.fund_open_fund_info_em(symbol=fund_code, indicator="单位净值走势", period="成立来")
            if df is not None and not df.empty:
                # 检查是否包含累计净值列
                has_cumulative = any('累计净值' in str(col) for col in df.columns)
                if not has_cumulative:
                    # 如果没有累计净值，尝试获取累计净值走势并合并
                    try:
                        df_cumulative = ak.fund.fund_em.fund_open_fund_info_em(symbol=fund_code, indicator="累计净值走势", period="成立来")
                        if df_cumulative is not None and not df_cumulative.empty:
                            # 找到日期列名
                            date_col = None
                            for col in df.columns:
                                if '日期' in str(col):
                                    date_col = col
                                    break
                            
                            if date_col:
                                # 合并两个数据源
                                df = df.merge(df_cumulative, on=date_col, how='outer', suffixes=('', '_cum'))
                    except Exception as e:
                        # 如果合并失败，继续使用单位净值数据
                        pass
        except Exception as e:
            last_error = e
            df = None
        
        # 方法2: 如果方法1失败，尝试获取累计净值走势
        if df is None or df.empty:
            try:
                df = ak.fund.fund_em.fund_open_fund_info_em(symbol=fund_code, indicator="累计净值走势", period="成立来")
            except Exception as e:
                last_error = e
                df = None
        
        if df is None or df.empty:
            raise Exception(f"无法获取基金数据，请检查基金代码是否正确。最后错误: {str(last_error)}")
        
        # 转换为字典列表
        data = []
        for _, row in df.iterrows():
            # 获取日期、单位净值和累计净值
            date = None
            net_value = None  # 单位净值
            cumulative_net_value = None  # 累计净值
            
            # 尝试不同的列名
            for col in df.columns:
                col_str = str(col)
                col_lower = col_str.lower()
                
                # 查找日期列
                if date is None and ('日期' in col_str or 'date' in col_lower or 'time' in col_lower):
                    try:
                        date_val = row[col]
                        if pd.notna(date_val):
                            date = str(date_val).split()[0] if ' ' in str(date_val) else str(date_val)
                    except:
                        pass
                
                # 查找单位净值列（排除累计净值）
                if net_value is None and '单位净值' in col_str and '累计' not in col_str:
                    try:
                        val = row[col]
                        if pd.notna(val):
                            net_value = float(val)
                    except:
                        pass
                
                # 查找累计净值列
                if cumulative_net_value is None and '累计净值' in col_str:
                    try:
                        val = row[col]
                        if pd.notna(val):
                            cumulative_net_value = float(val)
                    except:
                        pass
            
            # 如果日期和净值都存在，添加到结果
            # 优先使用单位净值，如果没有则使用累计净值作为单位净值
            if date and (net_value is not None or cumulative_net_value is not None):
                # 如果只有累计净值，则单位净值等于累计净值（这种情况通常发生在没有分红的基金）
                if net_value is None and cumulative_net_value is not None:
                    net_value = cumulative_net_value
                
                # 如果只有单位净值，则累计净值等于单位净值（这种情况通常发生在没有分红的基金）
                if cumulative_net_value is None and net_value is not None:
                    cumulative_net_value = net_value
                
                if net_value is not None and net_value > 0 and cumulative_net_value is not None and cumulative_net_value > 0:
                    data.append({
                        'date': date,
                        'netValue': float(net_value),  # 单位净值，用于计算申购份额
                        'cumulativeNetValue': float(cumulative_net_value)  # 累计净值，用于计算市值（包含分红）
                    })
        
        if not data:
            raise Exception("未能从返回数据中提取有效的净值信息，请检查基金代码是否正确")
        
        # 按日期排序
        data.sort(key=lambda x: x['date'])
        
        # 如果提供了日期范围，进行过滤
        if start_date:
            data = [item for item in data if item['date'] >= start_date]
        if end_date:
            data = [item for item in data if item['date'] <= end_date]
        
        return data
        
    except Exception as e:
        raise Exception(f"获取基金数据失败: {str(e)}")

if __name__ == "__main__":
    try:
        # 从命令行参数获取基金代码
        if len(sys.argv) < 2:
            print(json.dumps({"error": "请提供基金代码"}))
            sys.exit(1)
        
        fund_code = sys.argv[1]
        start_date = sys.argv[2] if len(sys.argv) > 2 else None
        end_date = sys.argv[3] if len(sys.argv) > 3 else None
        
        data = get_fund_data(fund_code, start_date, end_date)
        
        print(json.dumps({
            "success": True,
            "data": data
        }, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }, ensure_ascii=False))
        sys.exit(1)

