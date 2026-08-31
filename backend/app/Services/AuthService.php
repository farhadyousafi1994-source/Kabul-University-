<?php

namespace App\Services;

use App\Http\Resources\UserResource;
use App\Models\User;
use App\Notifications\PasswordResetNotification;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Business logic for authentication: login, logout, password change,
 * and password reset (architecture: Laravel password broker + tokens).
 */
class AuthService
{
    public function __construct(protected RateLimiter $limiter)
    {
    }

    /**
     * Attempt a login. Returns a fresh Sanctum token + user payload.
     *
     * @param  array{login: string, password: string}  $credentials
     * @return array{token: string, user: array<string, mixed>}
     *
     * @throws ValidationException
     */
    public function login(array $credentials): array
    {
        $this->ensureNotRateLimited($credentials['login']);

        $user = User::query()
            ->where(fn ($q) => $q->where('username', $credentials['login'])
                ->orWhere('email', $credentials['login']))
            ->first();

        $valid = $user && Hash::check($credentials['password'], $user->password);

        if (! $valid) {
            $this->hitRateLimiter($credentials['login']);
            throw ValidationException::withMessages([
                'login' => ['Invalid credentials.'],
            ]);
        }

        if ($user->status !== User::STATUS_ACTIVE) {
            throw new HttpResponseException(response()->json([
                'success' => false,
                'message' => 'Your account is deactivated. Please contact the administrator.',
            ], 403));
        }

        $this->limiter->clear($this->throttleKey($credentials['login']));

        $token = $user->createToken('ku-ams')->plainTextToken;

        return [
            'token' => $token,
            'user' => UserResource::make($user->load('roles.permissions', 'department'))->resolve(),
        ];
    }

    /**
     * Revoke the token used for the current request.
     */
    public function logout(User $user, ?string $token): void
    {
        if ($token) {
            $user->tokens()->where('token', hash('sha256', $token))->delete();
        }
    }

    /**
     * Change the authenticated user's password and revoke all other tokens.
     *
     * @param  array{current_password: string, new_password: string}  $data
     *
     * @throws ValidationException When the current password does not match.
     */
    public function changePassword(User $user, array $data): void
    {
        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        DB::transaction(function () use ($user, $data) {
            $user->forceFill([
                'password' => Hash::make($data['new_password']),
            ])->save();

            // Keep only the current token; revoke sessions on other devices.
            $user->tokens()->where('token', '!=', hash('sha256', $this->currentToken()))->delete();
        });
    }

    /**
     * Send a password reset link.
     *
     * @param  array{email: string}  $data
     */
    public function sendPasswordResetLink(array $data): void
    {
        Password::sendResetLink($data, function (User $user, string $token) {
            $user->notify(new PasswordResetNotification($token));
        });
    }

    /**
     * Reset the password using a broker-issued token.
     *
     * @param  array{email: string, token: string, password: string}  $data
     */
    public function resetPassword(array $data): void
    {
        $status = Password::reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->save();

                // Invalidate every session for the account.
                $user->tokens()->delete();
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }
    }

    // ------------------------------------------------------------------
    // Rate limiting
    // ------------------------------------------------------------------

    protected function throttleKey(string $login): string
    {
        return Str::lower($login).'|'.request()->ip();
    }

    protected function ensureNotRateLimited(string $login): void
    {
        $key = $this->throttleKey($login);
        if ($this->limiter->tooManyAttempts($key, 5)) {
            event(new Lockout(request()));

            $seconds = $this->limiter->availableIn($key);
            throw new HttpResponseException(response()->json([
                'success' => false,
                'message' => "Too many login attempts. Please try again in {$seconds} seconds.",
            ], 429));
        }
    }

    protected function hitRateLimiter(string $login): void
    {
        $this->limiter->hit($this->throttleKey($login), 60);
    }

    protected function currentToken(): string
    {
        return (string) Str::of(request()->bearerToken() ?? '');
    }

    /**
     * Standard unauthorized helper used by the controller.
     */
    public static function unauthorized(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Unauthenticated.',
        ], 401);
    }
}
