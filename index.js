const express = require('express');
const fetch = require('node-fetch');
const { createCanvas, loadImage, registerFont } = require('canvas');
const qr = require('qr-image');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 12306; //端口号

// 日志配置
const LOG_CONFIG = {
    level: 'debug', // 可选: debug, info, warn, error
    colors: {
        debug: '\x1b[36m', // 青色
        info: '\x1b[34m',  // 蓝色
        success: '\x1b[32m', // 绿色
        warn: '\x1b[33m',  // 黄色
        error: '\x1b[31m', // 红色
        reset: '\x1b[0m'   // 重置颜色
    }
};

// 日志记录器函数
function logger(level, message, meta = {}) {
    const levels = ['error', 'warn', 'info', 'success', 'debug'];
    if (levels.indexOf(level) > levels.indexOf(LOG_CONFIG.level)) return;

    const timestamp = new Date().toISOString();
    const color = LOG_CONFIG.colors[level] || '';
    const logEntry = {
        timestamp,
        level: level.toUpperCase(),
        requestId: meta.requestId || 'SYSTEM',
        message,
        ...meta
    };

    console.log(
        `${color}[${timestamp}] [${logEntry.level.padEnd(5)}] [${logEntry.requestId}] ${message}${LOG_CONFIG.colors.reset}`
    );

    // 如果是错误级别，打印堆栈跟踪
    if (level === 'error' && meta.error) {
        console.error(meta.error.stack);
    }
}


// 注册字体
const fontDir = path.join(__dirname, 'fonts');

// 微软雅黑 常规+粗体
registerFont(path.join(fontDir, 'msyh.ttc'), {
  family: 'Microsoft YaHei',
  weight: 'normal'
});
registerFont(path.join(fontDir, 'msyhbd.ttc'), {
  family: 'Microsoft YaHei',
  weight: 'bold'
});

// 仿宋
registerFont(path.join(fontDir, 'simfang.ttf'), {
  family: 'FangSong',
  weight: 'normal'
});

// Arial
registerFont(path.join(fontDir, 'arial.ttf'), {
  family: 'Arial',
  weight: 'normal'
});

// 确保存储目录存在
const certDir = path.join(__dirname, 'cert-img');
!fs.existsSync(certDir) && fs.mkdirSync(certDir, { recursive: true });

// 开放证书图片目录
app.use('/cert-img', express.static(certDir));

// 日期改大写
const DATE_DIGITS = ['〇','一','二','三','四','五','六','七','八','九'];
const MONTH_MAP = ['','一','二','三','四','五','六','七','八','九','十','十一','十二'];
const DAY_MAP = new Map([
  [1, '一'], [2, '二'], [3, '三'], [4, '四'], [5, '五'], [6, '六'], [7, '七'],
  [8, '八'], [9, '九'], [10, '十'], [11, '十一'], [12, '十二'], [13, '十三'],
  [14, '十四'], [15, '十五'], [16, '十六'], [17, '十七'], [18, '十八'], [19, '十九'],
  [20, '二十'], [21, '二十一'], [22, '二十二'], [23, '二十三'], [24, '二十四'],
  [25, '二十五'], [26, '二十六'], [27, '二十七'], [28, '二十八'], [29, '二十九'],
  [30, '三十'], [31, '三十一']
]);


// 日期转换函数
function formatChineseDate(isoString) {
    const date = new Date(isoString);
    
    // 年份处理
    const yearStr = date.getFullYear().toString();
    const yearCN = Array.from(yearStr).map(d => DATE_DIGITS[parseInt(d)]).join('');
    
    // 月份处理
    const month = date.getMonth() + 1;
    const monthCN = MONTH_MAP[month] || month.toString();
    
    // 日期处理
    const day = date.getDate();
    const dayCN = DAY_MAP.get(day) || day.toString();

    return `${yearCN}年${monthCN}月${dayCN}日`;
}


// 字间距配置
const TEXT_SPACING = {
    nickname: 12,   // 昵称间距
    level: 8,       // 等级间距
    code: 1,        // 证书编码间距
    date: 2         // 日期间距
}

// 处理头像裁剪
function processAvatar(avatar, targetWidth = 160, targetHeight = 210) {
    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    
    // 计算裁剪比例
    const aspectRatio = avatar.width / avatar.height;
    const targetRatio = targetWidth / targetHeight;
    
    let srcX = 0, srcY = 0, srcWidth = avatar.width, srcHeight = avatar.height;
    
    if (aspectRatio > targetRatio) {
        // 裁剪宽度
        srcWidth = avatar.height * targetRatio;
        srcX = (avatar.width - srcWidth) / 2;
    } else {
        // 裁剪高度
        srcHeight = avatar.width / targetRatio;
        srcY = (avatar.height - srcHeight) / 2;
    }
    
    ctx.drawImage(
        avatar,
        srcX, srcY, srcWidth, srcHeight,
        0, 0, targetWidth, targetHeight
    );
    return canvas;
}

/**
 * 绘制带自定义字间距的文本
 * @param {CanvasRenderingContext2D} ctx 画布上下文
 * @param {string} text 要绘制的文本
 * @param {number} centerX 文本中心X坐标
 * @param {number} y 文本基线Y坐标
 * @param {number} spacing 字符间距(像素)
 */
function drawTextWithSpacing(ctx, text, centerX, y, spacing) {
    const chars = Array.from(text);
    let totalWidth = 0;
    const charWidths = [];

    // 计算总宽度
    chars.forEach(char => {
        const width = ctx.measureText(char).width;
        charWidths.push(width);
        totalWidth += width + spacing;
    });
    totalWidth -= spacing; // 最后一个字符不加间距

    // 计算起始X坐标
    let x = centerX - totalWidth / 2;
    
    // 逐个绘制字符
    chars.forEach((char, index) => {
        ctx.fillText(char, x, y);
        x += charWidths[index] + spacing;
    });
}

app.get('/generate', async (req, res) => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    try {
        logger('info', '收到生成请求', {
            requestId,
            query: req.query
        });

        try {
            // 参数验证
            const { code } = req.query;
            if (!code || !/^FOXKP[A-Z0-9]{11}$/i.test(code)) {
                logger('warn', '无效的证书编码', { requestId });
                return res.status(400).json({ 
                    success: false, 
                    error: '无效的证书编码' 
                });
            }
		
		logger('debug', '开始处理证书生成', {
            requestId,
            code
        });

        // 调用API获取数据
		logger('debug', '调用证书信息获取API', { requestId });
        const apiResponse = await fetch(`https://kp.foxdice.cn/search/?code=${code}`);
        if (!apiResponse.ok) {
            const status = apiResponse.status;
            if (status === 404) return res.status(404).send('证书不存在');
            if (status === 429) return res.status(429).send('请求过于频繁');
            throw new Error(`API响应错误: ${status}`);
        }

        const { data } = await apiResponse.json();
        if (!data) throw new Error('无效的API响应');
		
        const certInfo = {
            nickname: data.nickname,
            qqnum: data.qqnum,
            level: data.level,
            code: data.code,
            date: formatChineseDate(data.created_at),
            verifyUrl: data.verify_url
        };
		
        // 准备文件路径和URL
        const fileName = `${certInfo.code}.jpg`;
        const filePath = path.join(certDir, fileName);
        const httpHead = `${req.protocol}://${req.get('host')}`;
        const imageUrl = `${httpHead}/cert-img/${fileName}`;

        // 缓存检查
        const fileExists = fs.existsSync(filePath);
        const forceUpdate = req.query.force === 'true';

        if (fileExists && !forceUpdate) {
			logger('success', '返回缓存结果', {
                requestId,
                cached: true
            });
            return res.json({
                success: true,
                data: {
                    image_url: imageUrl,
                    verify_url: certInfo.verifyUrl,
                    code: certInfo.code,
                    cached: true
                }
            });
        }

		logger('debug', '开始绘制证书内容', { requestId });
        // 创建画布
        const canvas = createCanvas(1280, 854);
        const ctx = canvas.getContext('2d');

        // 绘制背景
        const bgImage = await loadImage('./backgrounds/bg-face-4.png');
        ctx.drawImage(bgImage, 0, 0, 1280, 854);

        // 设置通用样式
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';

        // 绘制昵称
        ctx.font = 'bold 24px "FangSong"';
		drawTextWithSpacing(
			ctx, 
			certInfo.nickname, 
			435,
			417, 
			TEXT_SPACING.nickname
		);

        // 绘制等级
        ctx.font = '22px "Microsoft YaHei"';
		drawTextWithSpacing(
			ctx,
			certInfo.level,
			355,
			490,
			TEXT_SPACING.level
		);

        // 绘制证书编号
        ctx.font = '22px "Arial"';
		drawTextWithSpacing(
			ctx,
			certInfo.code,
			686,
			288,
			TEXT_SPACING.code
		);

        // 绘制日期
        ctx.font = '20px "FangSong"';
		drawTextWithSpacing(
			ctx,
			certInfo.date,
			950,
			605,
			TEXT_SPACING.date
		);

        // 绘制QQ头像
        if (certInfo.qqnum) {
            try {
                const avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${certInfo.qqnum}&s=640`;
                const avatar = await loadImage(avatarUrl);

                const processedAvatar = processAvatar(avatar);
                ctx.drawImage(processedAvatar, 880, 330);
            } catch (error) {
                console.error('头像处理失败:', error);
            }
        }

        // 生成二维码
        const qrBuffer = qr.imageSync(certInfo.verifyUrl, {
            type: 'png',
            margin: 0,
            size: 8
        });
        const qrImage = await loadImage(qrBuffer);
        ctx.drawImage(qrImage, 255, 565, 110, 110);
		logger('debug', '证书绘制完成', { requestId });
		
        // 保存图片到文件系统
		const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.9 });

        // 保存文件
        fs.writeFileSync(filePath, imageBuffer);
        logger('success', '证书文件已保存', {
            requestId,
            filePath,
            fileSize: `${(imageBuffer.length / 1024).toFixed(2)}KB`
        });

        logger('success', '证书生成成功', { requestId });

        res.json({
            success: true,
            data: {
                image_url: imageUrl,
                verify_url: certInfo.verifyUrl,
                code: certInfo.code,
                cached: false
            }
        });

        } catch (innerError) {
            logger('error', '处理流程错误', {
                requestId,
                error: innerError.message
            });
            return res.status(500).json({
                success: false,
                error: innerError.message
            });
        }

    } catch (outerError) {
        logger('critical', '系统级错误', {
            requestId,
            error: outerError.message
        });
        return res.status(500).json({
            success: false,
            error: '系统服务不可用'
        });
    }
});
app.listen(port, () => {
    const color = {
        reset: '\x1b[0m',
        gradient: ['\x1b[38;5;202m', '\x1b[38;5;208m', '\x1b[38;5;214m'], // 橙黄渐变
        green: '\x1b[32m'
    };

    const asciiArt = `
${color.gradient[0]}███████╗ ██████╗ ██╗  ██╗██████╗ ██╗╔██████╗╔███████╗
${color.gradient[1]}██╔════╝██╔═══██╗╚██╗██╔╝██╔══██╗██║║██╔═══╝║██╔════╝
${color.gradient[2]}█████╗  ██║   ██║ ╚███╔╝ ██║  ██║██║║██║    ║██████╗  
${color.gradient[1]}██╔══╝  ██║   ██║ ██╔██╗ ██║  ██║██║║██║    ║██ ╔══╝  
${color.gradient[0]}██║     ╚██████╔╝██║  ██║██████╔╝██║║██████╗║███████╗
${color.reset}══════════════════════════════════════════════════════════════════
    `;

    console.log(`
${asciiArt}
${color.green}
╔══════════════════════════════════════════╗
  证书绘制服务已启动：http://localhost:${port.toString().padEnd(5)}  
  ${new Date().toLocaleString().padEnd(32)} 
╚══════════════════════════════════════════╝
${color.reset}
    `);
});