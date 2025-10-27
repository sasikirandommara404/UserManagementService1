import nodemailer from 'nodemailer';
import { EMAIL_USER, EMAIL_PASS} from '../config/env.Validation.js' ; 
import logger from '../logger.js';
import e from 'express';
logger.info('EMAIL_USER:', EMAIL_USER, 'EMAIL_PASS:', EMAIL_PASS ? 'set' : 'not set');
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

transporter.verify((error, success) => {
    if(error){
        console.log("Error in connecting with gmail", error)
    }else{
        console.log("Connected to gmail account")
    }
});



const sendEmail = async (to,token) => {
    const verificationLink = `http://localhost:3001/api/auth/verify/${token}`;
    const mailOptions = {
        from: EMAIL_USER,
        to: to,
        subject: 'Email Verification',
        html: `<p>Click the link below to verify your email:</p><a href="${verificationLink}">Verify Email</a>`
    };
    try {
        logger.info('Sending email to:', to);
        const info = await transporter.sendMail(mailOptions);
        logger.info('Email sent successfully:', info.response);
        return {sucess:true,messageId:info.messageId};
    } catch (error) {
        logger.error('Error sending email:', error.message);
        logger.error('Error details:', error);
        throw error;
    }
};
export default sendEmail;
export { transporter, sendEmail };
