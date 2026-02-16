<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordFrontendNotification extends ResetPassword
{
    /**
     * Build the mail representation of the notification.
     */
    public function toMail($notifiable)
    {
        $frontendUrl = rtrim((string) (env('FRONTEND_URL') ?: config('app.url')), '/');
        $email = (string) $notifiable->getEmailForPasswordReset();

        $url = $frontendUrl . '/auth/reset-password?token=' . urlencode((string) $this->token)
            . '&email=' . urlencode($email);

        return (new MailMessage)
            ->subject('Réinitialisation du mot de passe')
            ->line('Vous recevez cet email parce que nous avons reçu une demande de réinitialisation du mot de passe pour votre compte.')
            ->action('Réinitialiser le mot de passe', $url)
            ->line('Ce lien de réinitialisation expirera dans 60 minutes.')
            ->line("Si vous n'avez pas demandé une réinitialisation du mot de passe, aucune action n'est requise.");
    }
}
