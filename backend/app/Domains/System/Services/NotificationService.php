<?php

namespace App\Domains\System\Services;

use App\Models\User;

/**
 * Module 20 — Notifications.
 * In-app notifications are stored through Laravel's notifications table
 * (DatabaseChannel-ready). The payload is kept channel-neutral so Email,
 * SMS and WhatsApp channels can be attached later without refactoring.
 */
class NotificationService
{
    public static function send(int|User $user, string $type, string $title, string $message, string $icon = 'notifications'): void
    {
        $user = $user instanceof User ? $user : User::find($user);
        if (! $user) {
            return;
        }

        $user->notifications()->create([
            'type' => 'App\\Notifications\\InAppNotification',
            'data' => [
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'icon' => $icon,
            ],
        ]);
    }
}
