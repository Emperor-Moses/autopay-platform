import { Controller, Get, Res } from "@nestjs/common";
import { Response }             from "express";

@Controller()
export class PaymentCallbackController {

  @Get("account-linked")
  accountLinked(@Res() res: Response) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AutoPay – Card Linked</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0c140c;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .card {
            background: #1a2e1a;
            border: 1px solid #2edc72;
            border-radius: 16px;
            padding: 40px 32px;
            text-align: center;
            max-width: 360px;
            width: 100%;
          }
          .icon { font-size: 56px; margin-bottom: 16px; }
          h1 { color: #2edc72; font-size: 22px; margin-bottom: 10px; }
          p { color: #9ab09a; font-size: 14px; line-height: 1.6; }
          .note {
            margin-top: 24px;
            background: rgba(46,220,114,0.08);
            border-radius: 10px;
            padding: 14px;
            color: #2edc72;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>Payment Successful</h1>
          <p>Your card has been verified and linked to AutoPay.</p>
          <div class="note">
            You can now close this page and return to the AutoPay app.
          </div>
        </div>
      </body>
      </html>
    `);
  }

  @Get("plan-upgraded")
  planUpgraded(@Res() res: Response) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AutoPay – Plan Upgraded</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0c140c;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .card {
            background: #1a2e1a;
            border: 1px solid #2edc72;
            border-radius: 16px;
            padding: 40px 32px;
            text-align: center;
            max-width: 360px;
            width: 100%;
          }
          .icon { font-size: 56px; margin-bottom: 16px; }
          h1 { color: #2edc72; font-size: 22px; margin-bottom: 10px; }
          p { color: #9ab09a; font-size: 14px; line-height: 1.6; }
          .note {
            margin-top: 24px;
            background: rgba(46,220,114,0.08);
            border-radius: 10px;
            padding: 14px;
            color: #2edc72;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🎉</div>
          <h1>Plan Upgraded!</h1>
          <p>Your AutoPay plan has been activated successfully.</p>
          <div class="note">
            You can now close this page and return to the AutoPay app.
          </div>
        </div>
      </body>
      </html>
    `);
  }
}