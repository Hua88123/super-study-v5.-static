# 超能游学报价系统 V7 长期稳定云端版

## 这个版本是为了长期稳定使用

目标：

- 设置一次，后期长期使用
- 员工直接打开普通网址就能同步
- 不需要给员工复杂的云端同步链接
- 软件里不再填写 Supabase URL 和 Key
- Supabase 密钥放在 Vercel 环境变量里
- 浏览器不直接连接 Supabase，避免手机网络访问不了 Supabase 的问题

## 长期稳定架构

用户手机 / 员工电脑
→ 打开你的 Vercel 网站
→ Vercel API 中转
→ Supabase 数据库

## 第一次设置步骤

### 1. Supabase 运行建表 SQL

Supabase → SQL Editor → New query

粘贴：

supabase建表SQL.txt

运行。

### 2. Vercel 设置环境变量

Vercel 项目 → Settings → Environment Variables

添加：

SUPABASE_URL
https://你的项目ID.supabase.co

SUPABASE_SERVICE_ROLE_KEY
粘贴 Supabase 的 service_role / secret key

可选：

SUPABASE_TABLE = super_study_data
SUPABASE_ROW = main

### 3. 重新部署

Vercel → Deployments → 最新部署 → Redeploy

### 4. 软件里操作

管理员登录 → 系统设置 → V7 长期稳定云端同步

点击：

测试云端连接

然后点击：

上传本地数据到云端

完成后，员工直接打开普通网址即可同步。

## 后期使用

你以后只需要：

管理员登录 → 修改学校/课程/房型/优惠/学杂费 → 保存

系统会自动上传到云端。

员工手机刷新页面，就会自动读取最新数据。

## 已保留全部功能

- 员工 / 管理员权限
- 员工只看自动报价
- 每个学校独立优惠自动切换
- 没有对应折扣不显示在报价单
- 签证延期第9/12/16/20周自动切换金额
- ACR I-Card 第9周起自动计算
- Books 4/8/12周金额设置
- 宿舍押金、接机费不计入学杂费合计
- 报价单底部标记宿舍押金、接机费不含
- 下载报价单图片全图水印，覆盖费用一和费用二
- PNG 报价单
- 一页 PDF
- 微信报价复制
- 报价记录保存
