

// async..await is not allowed in global scope, must use a wrapper
     
// สร้างออปเจ็ค transporter เพื่อกำหนดการเชื่อมต่อ SMTP และใช้ตอนส่งเมล

// เริ่มทำการส่งอีเมล

const textMail = (req,res)=>{
    const {to, subject, text } = req.body;
    const mailData = {
        from: 'kwanmhn@gmail.com',
        to: to,
        subject: subject,
        text: text,
        html: '<b>Hey there! </b><br> This is our first message sent with Nodemailer<br/>'
    };

    transporter.sendMail(mailData, (error, info) => {
        if (error) {
         console.log(error);
        }
        res.status(200).send({ message: "Mail send", message_id: info.messageId });
    });
    res.send('OK');
}

module.exports={
    textMail,
}