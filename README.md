# 超能游学报价系统 V5 静态稳定版

## 为什么重新做这个版本

你现在 Vercel 报错停在：

npm install exited with 1
npm error Exit handler never called!

这说明不是页面代码错误，而是 Vercel 在安装 npm 依赖时失败。

所以这个版本彻底改成静态系统：

- 不用 Next.js
- 不用 React
- 不用 npm 安装依赖
- 不用 build
- 只有 HTML + CSS + JS
- Vercel 直接当静态网站发布

这样可以绕开 npm install 失败的问题。

## 已保留功能

- 自动报价
- 每个学校独立优惠
- 每个学校独立本地费用
- 菲律宾本地费用统一模板
- 入学日期统一周日
- 学校淡季折扣，可独立设置比例，可勾选是否启用
- 超能优惠减免注册金，可独立设置金额，可勾选是否启用
- 美金 / 披索汇率换算
- 学费人民币 + 本地费用人民币 + 总人民币
- 报价单图片 PNG 导出
- 一页 PDF
- 超能游学 Logo
- 满铺水印
- 报价记录保存
- 微信报价复制
- 数据导出 / 导入备份

## 部署方式

上传覆盖 GitHub 根目录：

- index.html
- styles.css
- script.js
- vercel.json
- package.json
- .npmrc
- README.md
- public/superstudy-logo.png

重点：

1. 这次不需要上传 app 文件夹。
2. 旧 app 文件夹留着也没事，系统会走 index.html 静态版。
3. Vercel 重新部署时请选择：Redeploy without Build Cache。
4. 如果 Vercel 项目里之前设置了 Framework Preset = Next.js，建议改成 Other。

## 如果还失败

进入 Vercel 项目设置：

Settings → General → Build & Development Settings

改成：

- Framework Preset：Other
- Build Command：echo skip build
- Output Directory：.
- Install Command：echo skip install
