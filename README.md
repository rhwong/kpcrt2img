# kpcrt2img
使用 https://kp.foxdice.cn/ 的接口查询证书并绘制图像

## 安装方法

1.去release下载我打包好的Windows包,双击`启动.exe`

2.自己安装nodejs

你还是要下载我打包好的release包，因为里面包含字体文件。

然后执行
  ```
  npm init -y
  npm install express node-fetch canvas qr-image node-fetch@2
  node index.js
```

## 使用方法

服务启动后，访问 `http://localhost:12306/generate?code=FOXKP0717B2A7572` 来通过证书code打印证书信息。

正常情况下，图像文件会保存在 `cert-img` 目录下，并且API会返回如下示例信息：

```
{
  "success": true,
  "data": {
    "image_url": "http://localhost:12306/cert-img/FOXKP0717B2A7572.jpg",
    "verify_url": "http://kp.foxdice.cn/show?code=FOXKP0717B2A7572",
    "code": "FOXKP0717B2A7572",
    "cached": false
  }
}
```

有缓存机制，如果已经生成过的证书图像，会立即返回信息，而不执行生成流程。

如果 `"cached": true` 意味着当前返回信息为缓存图像。

你可以在请求里增加 `force=true` 参数，强制生成新的证书图像。
