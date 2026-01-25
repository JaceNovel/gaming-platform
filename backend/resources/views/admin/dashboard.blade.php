<x-app-layout>
    <x-slot name="header">
        <h2 class="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
            {{ __('Console administrateur') }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
            <div class="overflow-hidden bg-white p-6 shadow sm:rounded-lg dark:bg-gray-800">
                <p class="text-sm text-gray-600 dark:text-gray-300">
                    {{ __('Vous êtes connecté en tant qu\'administrateur. Toutes les routes /admin/* restent protégées côté serveur et redirigent automatiquement vers /login si la session expire.') }}
                </p>
                <p class="mt-4 text-sm text-gray-600 dark:text-gray-300">
                    {{ __('Connectez l\'interface React/Next à cette page ou servez votre SPA via /admin/* : le middleware admin appliquera toujours les vérifications de rôle et d\'adresse IP.') }}
                </p>
            </div>
        </div>
    </div>
</x-app-layout>
