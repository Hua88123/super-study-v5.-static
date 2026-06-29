# 超能游学报价系统 V8 云端重复ID保存修正版

## 本次修复

修复保存云端时报错：

duplicate key value violates unique constraint "super_study_data_pkey"
Key (id)=(main) already exists

原因：
云端已经有 main 这一条数据，旧接口再次上传时用了 insert，导致 Supabase 报重复 ID。

已改成：
上传云端时自动 upsert（存在就覆盖更新，不存在就新建）。

## 你需要做什么

上传覆盖 GitHub 后，Vercel 重新 Redeploy。

不需要删除 Supabase 数据。
不需要重新建表。
不需要重新填写环境变量。

## 保留功能

- 8周长期优惠
- 保存学校设置明确同步云端
- 员工授权登录
- 一人一码
- 单设备绑定
- 手机图片下载修复
- 签证延期新规则
- 云端同步
