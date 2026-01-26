<?php

namespace Database\Seeders;

use App\Models\EmailTemplate;
use Illuminate\Database\Seeder;

class EmailTemplateSeeder extends Seeder
{
    public function run(): void
    {
        EmailTemplate::updateOrCreate(
            ['key' => 'redeem_code_delivery'],
            [
                'name' => 'Livraison code redeem',
                'subject' => 'Votre recharge Free Fire est prête',
                'body' => <<<HTML
<h2>Recharge confirmée</h2>
<p>Bonjour {{user.name}},</p>
<p>Votre paiement pour la commande <strong>{{order.reference}}</strong> est confirmé.</p>
<p>Voici vos codes :</p>
{{codes_html}}
<p>Instructions :</p>
<ol>
  <li>Ouvrez Free Fire et accédez au centre de recharge.</li>
  <li>Sélectionnez "Utiliser un code" puis saisissez le code.</li>
  <li>Validez pour recevoir vos diamants.</li>
</ol>
<p>Merci,<br/>L'équipe BADBOYSHOP</p>
HTML,
                'is_active' => true,
            ]
        );

        EmailTemplate::updateOrCreate(
            ['key' => 'payment_success'],
            [
                'name' => 'Paiement confirmé',
                'subject' => 'Paiement réussi - BADBOYSHOP',
                'body' => <<<HTML
<h2>Paiement confirmé</h2>
<p>Bonjour {{user.name}},</p>
<p>Votre paiement pour la commande <strong>{{order.reference}}</strong> a bien été reçu.</p>
<p>Montant : <strong>{{order.total_price}}</strong></p>
<p>Merci,<br/>L'équipe BADBOYSHOP</p>
HTML,
                'is_active' => true,
            ]
        );

        EmailTemplate::updateOrCreate(
            ['key' => 'topup_confirmation'],
            [
                'name' => 'Confirmation recharge',
                'subject' => 'Confirmation de recharge BADBOYSHOP',
                'body' => <<<HTML
<h2>Recharge en cours</h2>
<p>Bonjour {{user.name}},</p>
<p>Votre demande de recharge pour la commande <strong>{{order.reference}}</strong> a bien été reçue.</p>
<p>Notre équipe traite votre demande.</p>
<p>Merci,<br/>L'équipe BADBOYSHOP</p>
HTML,
                'is_active' => true,
            ]
        );
    }
}
