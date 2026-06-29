# 超能游学报价系统 V7 云端连接诊断修复版

如果 `/api/data` 显示 `{"error":"fetch failed"}`，这个版本可以显示更具体的错误。

## 部署后测试

打开：

https://你的Vercel网址/api/data?debug=1

成功会显示：

"ok": true

失败会显示具体原因，例如环境变量缺失、URL错误、连接超时、表不存在、权限错误等。

## 必须重新部署

上传覆盖 GitHub 后，Vercel 必须 Redeploy。

## 环境变量

SUPABASE_URL = https://你的项目ID.supabase.co

SUPABASE_SERVICE_ROLE_KEY = Supabase 的 service_role key

注意 SUPABASE_URL 不要加 /rest/v1/
