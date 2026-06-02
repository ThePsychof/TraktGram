/**
 * HTML template for OAuth success page
 * Shown to user after successful Trakt account connection
 */
export const getSuccessPageHTML = (username: string): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TraktGram - Connection Successful</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }

    .success-icon {
      font-size: 48px;
      margin-bottom: 20px;
      animation: scaleIn 0.5s ease-out;
    }

    @keyframes scaleIn {
      from {
        transform: scale(0);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .user-info {
      background: #f5f5f5;
      border-left: 4px solid #667eea;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 30px;
      text-align: left;
    }

    .user-info-label {
      color: #999;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }

    .user-info-value {
      color: #333;
      font-size: 16px;
      font-weight: 600;
      font-family: 'Monaco', 'Courier New', monospace;
    }

    .features {
      text-align: left;
      margin-bottom: 30px;
    }

    .features-title {
      color: #333;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .features-list {
      list-style: none;
      font-size: 13px;
      color: #666;
      line-height: 1.8;
    }

    .features-list li::before {
      content: "✓ ";
      color: #667eea;
      font-weight: bold;
      margin-right: 8px;
    }

    .instructions {
      background: #f0f4ff;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 25px;
      text-align: left;
    }

    .instructions-title {
      color: #667eea;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }

    .instructions-text {
      color: #333;
      font-size: 13px;
      line-height: 1.6;
    }

    .button-group {
      display: flex;
      gap: 10px;
      flex-direction: column;
    }

    .button {
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
    }

    .button-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .button-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    .button-secondary {
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ddd;
    }

    .button-secondary:hover {
      background: #efefef;
      border-color: #bbb;
    }

    .footer {
      color: #999;
      font-size: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }

    .footer a {
      color: #667eea;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 480px) {
      .container {
        padding: 30px 20px;
      }

      h1 {
        font-size: 20px;
      }

      .success-icon {
        font-size: 40px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">✅</div>

    <h1>Connection Successful!</h1>

    <div class="subtitle">
      Your Trakt account has been successfully connected to TraktGram.
    </div>

    <div class="user-info">
      <div class="user-info-label">Connected Account</div>
      <div class="user-info-value">${username}</div>
    </div>

    <div class="features">
      <div class="features-title">Now Available:</div>
      <ul class="features-list">
        <li>Watchlist access</li>
        <li>View watch history</li>
        <li>Manage your collection</li>
        <li>See your ratings</li>
        <li>Track show progress</li>
        <li>Get recommendations</li>
      </ul>
    </div>

    <div class="instructions">
      <div class="instructions-title">Next Steps</div>
      <div class="instructions-text">
        You can now return to Telegram and use the <code>/me</code> command to verify your connection, or start using your authenticated features.
      </div>
    </div>

    <div class="button-group">
      <a href="https://t.me/TraktGram_Bot" class="button button-primary">Back to Telegram</a>
      <a href="https://trakt.tv" class="button button-secondary">Visit Trakt.tv</a>
    </div>

    <div class="footer">
      <p>TraktGram • Telegram Bot for Trakt.tv</p>
      <p><a href="https://github.com">GitHub</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export const getErrorPageHTML = (errorMessage: string): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TraktGram - Connection Failed</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }

    .error-icon {
      font-size: 48px;
      margin-bottom: 20px;
      animation: shake 0.5s ease-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }

    h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .error-message {
      background: #fee;
      border-left: 4px solid #f5576c;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 30px;
      color: #333;
      font-size: 14px;
      line-height: 1.6;
      text-align: left;
    }

    .help-text {
      color: #666;
      font-size: 13px;
      margin-bottom: 30px;
      line-height: 1.6;
    }

    .button {
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    .footer {
      color: #999;
      font-size: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }

    @media (max-width: 480px) {
      .container {
        padding: 30px 20px;
      }

      h1 {
        font-size: 20px;
      }

      .error-icon {
        font-size: 40px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">❌</div>

    <h1>Connection Failed</h1>

    <div class="error-message">
      <strong>Error:</strong> ${errorMessage}
    </div>

    <div class="help-text">
      <p>There was an issue connecting your Trakt account. This might be due to:</p>
      <ul style="text-align: left; margin: 10px 0; padding-left: 20px;">
        <li>The login session expired</li>
        <li>A network error</li>
        <li>Invalid authorization</li>
      </ul>
      <p>Please try again or contact support if the problem persists.</p>
    </div>

    <a href="https://t.me/TraktGram_Bot?start=login" class="button">Try Again</a>

    <div class="footer">
      <p>TraktGram • Telegram Bot for Trakt.tv</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};
