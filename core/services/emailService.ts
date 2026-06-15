import { app } from './firebaseServices';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'europe-west1');
const sendEmailCallable = httpsCallable(functions, 'sendEmail');

interface EmailAttachment {
    content: string; // Base64 string
    filename: string;
    type?: string;
}

interface SendEmailParams {
    to: string;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    attachment?: EmailAttachment;
}

const sendBackupPasswordResetCallable = httpsCallable(functions, 'sendBackupPasswordResetEmail');

export const sendOutboundEmail = async (params: SendEmailParams): Promise<boolean> => {
    try {
        console.log(`Sending email to ${params.to} using SendGrid Cloud Function...`);
        const result: any = await sendEmailCallable(params);
        return !!result.data?.success;
    } catch (error) {
        console.error("Error calling sendEmail Cloud Function:", error);
        throw error;
    }
};

export const sendBackupPasswordReset = async (
    email: string,
    backupEmail: string,
    continueUrl: string
): Promise<boolean> => {
    try {
        console.log(`Sending backup reset email for ${email} to ${backupEmail}...`);
        const result: any = await sendBackupPasswordResetCallable({ email, backupEmail, continueUrl });
        return !!result.data?.success;
    } catch (error) {
        console.error("Error calling sendBackupPasswordResetEmail Cloud Function:", error);
        throw error;
    }
};
