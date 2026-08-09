import { Match, Show, Switch, onCleanup, onMount, type Component } from 'solid-js';
import { TitleBar } from './components/TitleBar';
import { HomeScreen } from './components/screens/HomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { GameScreen } from './components/screens/GameScreen';
import { ResultsScreen } from './components/screens/ResultsScreen';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import { AdminPanel } from './components/dialogs/AdminPanel';
import { PlayerCardDialog } from './components/dialogs/PlayerCardDialog';
import {
    AboutDialog,
    EndQuizDialog,
    JoinRoomDialog,
    OnboardingDialog,
    ReportDialog,
    ShareOverlay,
} from './components/dialogs/MiscDialogs';
import { Spinner } from './components/ui';
import { Trophy } from './components/icons';
import { applyDocumentLocale, t } from './i18n';
import { achievementPop, state } from './state/game';
import {
    autoJoinDiscordVoiceRoom,
    handleActivityJoin,
    handleMultiplayerUpdate,
    onMultiplayerKicked,
    applyChallenge,
    selectMode,
    setAuthError,
    setBootLoading,
    showScreen,
} from './state/game';
import { showDialog, shouldShowOnboarding } from './state/ui';
import { activityReady, discordActivity, onActivityJoin } from './lib/discord';
import { challengeFromUrl, parseChallengePayload } from './lib/challenge';
import { handleDiscordOAuthReturn, playerName } from './lib/identity';
import { configureErrorLogContext, installErrorLogging } from './lib/errorLog';
import { installUiScale } from './lib/uiScale';
import { startHeartbeat } from './lib/heartbeat';
import { leaveBeacon, mpRoom, setMultiplayerHandlers } from './lib/multiplayer';
import { isDiscordEmbed } from './lib/platform';

const DISCORD_HANDSHAKE_BUDGET_MS = 8000;
const BOOT_VEIL_SAFETY_MS = 12_000;

async function boot(): Promise<void> {
    // Capture errors from the very first line, before any UI wiring.
    installErrorLogging();
    configureErrorLogContext(
        () => {
            try {
                return playerName();
            } catch {
                return null;
            }
        },
        () => state.mode,
    );

    installUiScale();
    applyDocumentLocale();
    setMultiplayerHandlers(handleMultiplayerUpdate, onMultiplayerKicked);
    onActivityJoin((secret) => void handleActivityJoin(secret));

    // Inside Discord, show a veil while the handshake + auto-join run, so the
    // player sees a spinner rather than a flash of Home before the lobby.
    const bootInDiscord = isDiscordEmbed();
    if (bootInDiscord) {
        setBootLoading(true);
        setTimeout(() => setBootLoading(false), BOOT_VEIL_SAFETY_MS);
    }

    // Give the Activity a bounded window to initialise; fall through to the normal
    // app if it stalls so the UI is never frozen.
    let readyInTime = false;
    await Promise.race([
        activityReady.then((ok) => {
            readyInTime = ok;
        }),
        new Promise<void>((resolve) => setTimeout(resolve, DISCORD_HANDSHAKE_BUDGET_MS)),
    ]);

    // A cold first launch can finish the handshake AFTER the bounded wait. Re-apply
    // the Discord-dependent flow the moment it lands, so the player never has to
    // relaunch just to have their name read.
    if (!readyInTime) {
        void activityReady.then(async (ok) => {
            if (!ok) return;
            if (state.screen === 'home' && !state.multiplayer && !state.challenge) {
                await autoJoinDiscordVoiceRoom();
            }
            setBootLoading(false);
        });
    }

    const loginError = await handleDiscordOAuthReturn();
    if (loginError) setAuthError(t('discordLoginFailed'));

    // A friend arriving from a "Challenge a friend" link carries the challenger's
    // mode, settings and score — in Discord via custom_id, on the web via ?challenge.
    const challenge =
        (discordActivity.active ? parseChallengePayload(discordActivity.customId) : null) ??
        challengeFromUrl();
    if (challenge) applyChallenge(challenge);

    if (discordActivity.active && !challenge) {
        const joined = await autoJoinDiscordVoiceRoom();
        if (joined) {
            setBootLoading(false);
            return;
        }
    }

    const awaitingLateJoin = bootInDiscord && !challenge && !discordActivity.active;
    if (!awaitingLateJoin) setBootLoading(false);

    showScreen('home');
    await selectMode(state.mode);
    startHeartbeat(() => ({
        screen: state.screen,
        inRoom: mpRoom() !== null,
        mode: state.mode,
    }));

    if (!challenge && shouldShowOnboarding()) {
        setTimeout(() => showDialog('onboarding'), 500);
    }
}

export const App: Component = () => {
    onMount(() => {
        void boot();
        // Leave the room if the player closes the window, refreshes or navigates
        // away — a keepalive beacon still flushes while the page is unloading.
        window.addEventListener('pagehide', leaveBeacon);
        window.addEventListener('beforeunload', leaveBeacon);
    });

    onCleanup(() => {
        window.removeEventListener('pagehide', leaveBeacon);
        window.removeEventListener('beforeunload', leaveBeacon);
    });

    return (
        <>
            <TitleBar />

            <main id="app" class="relative min-h-screen">
                <Switch>
                    <Match when={state.screen === 'home'}>
                        <HomeScreen />
                    </Match>
                    <Match when={state.screen === 'lobby'}>
                        <LobbyScreen />
                    </Match>
                    <Match when={state.screen === 'game'}>
                        <GameScreen />
                    </Match>
                    <Match when={state.screen === 'results'}>
                        <ResultsScreen />
                    </Match>
                </Switch>
            </main>

            <Show when={state.bootLoading}>
                <div
                    role="status"
                    aria-live="polite"
                    class="fixed inset-0 z-[60] grid place-items-center gap-3 bg-bg-0/95"
                >
                    <div class="flex flex-col items-center gap-3">
                        <Spinner size={32} />
                        <p class="text-sm text-muted">{t('bootLoading')}</p>
                    </div>
                </div>
            </Show>

            <Show when={achievementPop()}>
                {(pop) => (
                    <div
                        role="status"
                        class="fixed inset-x-0 top-4 z-50 mx-auto flex w-fit items-center gap-2 rounded-xl border border-gold/40 bg-panel/95 px-4 py-2 shadow-xl"
                    >
                        <span class="text-gold">
                            <Trophy size={20} />
                        </span>
                        <div>
                            <p class="text-sm font-bold text-gold">{pop().title}</p>
                            <p class="text-xs text-muted">{pop().body}</p>
                        </div>
                    </div>
                )}
            </Show>

            <SettingsDialog />
            <AboutDialog />
            <JoinRoomDialog />
            <EndQuizDialog />
            <ReportDialog />
            <OnboardingDialog />
            <AdminPanel />
            <PlayerCardDialog />
            <ShareOverlay />

            <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {state.liveMessage}
            </p>
        </>
    );
};
