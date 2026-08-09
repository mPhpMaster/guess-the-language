import { Show, createSignal, type Component } from 'solid-js';
import { difficultyLabel, locale, setLocale, t } from '../../i18n';
import { LOCALES, type Locale } from '../../types/models';
import {
    DIFFICULTY_FILTERS,
    FEEDBACK_DELAYS,
    QUESTION_COUNTS,
    TIMER_CHOICES,
    settings,
    updateSettings,
} from '../../lib/settings';
import {
    discordLoginAvailable,
    discordLogout,
    discordProfile,
    isDiscordLinked,
    linkedUser,
    startDiscordLogin,
} from '../../lib/identity';
import { discordActivity } from '../../lib/discord';
import { sanitizeName } from '../../lib/names';
import { UI_SCALE_STEP, nudgeUiScale, uiScale } from '../../lib/uiScale';
import { closeDialog, isDialogOpen } from '../../state/ui';
import { state } from '../../state/game';
import { Button, Modal, Select, SettingRow, TextInput, Toggle } from '../ui';
import { LogOut, MessageCircle, Minus, Plus } from '../icons';

export const SettingsDialog: Component = () => {
    const [nameDraft, setNameDraft] = createSignal(settings().name);
    const locked = (): boolean => isDiscordLinked();

    return (
        <Modal
            open={isDialogOpen('settings')}
            title={t('settingsTitle')}
            description={t('settingsDescription')}
            onClose={closeDialog}
        >
            <SettingRow label={t('settingLanguage')}>
                <Select<Locale>
                    value={locale()}
                    options={LOCALES.map((code) => ({
                        value: code,
                        label: code === 'en' ? 'English' : 'العربية',
                    }))}
                    onChange={setLocale}
                />
            </SettingRow>

            <SettingRow label={t('settingUiScale')}>
                <button
                    type="button"
                    class="grid h-7 w-7 place-items-center rounded-md glass-panel"
                    aria-label="-"
                    onClick={() => nudgeUiScale(-UI_SCALE_STEP)}
                >
                    <Minus size={14} />
                </button>
                <span class="w-12 text-center text-sm" aria-live="polite">
                    {Math.round(uiScale() * 100)}%
                </span>
                <button
                    type="button"
                    class="grid h-7 w-7 place-items-center rounded-md glass-panel"
                    aria-label="+"
                    onClick={() => nudgeUiScale(UI_SCALE_STEP)}
                >
                    <Plus size={14} />
                </button>
            </SettingRow>

            <SettingRow
                label={locked() ? t('settingNameDiscord') : t('settingName')}
                for="set-name"
            >
                <TextInput
                    id="set-name"
                    maxLength={24}
                    autocomplete="off"
                    placeholder="User"
                    disabled={locked()}
                    value={locked() ? (discordProfile()?.name ?? '') : nameDraft()}
                    onInput={(event) => setNameDraft(event.currentTarget.value)}
                    onChange={() => updateSettings({ name: sanitizeName(nameDraft()) })}
                />
            </SettingRow>
            <Show when={locked()}>
                <p class="py-1 text-xs text-muted">{t('discordNameNote')}</p>
            </Show>

            <Show when={discordLoginAvailable() && !linkedUser()}>
                <Button
                    variant="discord"
                    size="sm"
                    block
                    class="my-2"
                    icon={<MessageCircle size={15} />}
                    onClick={startDiscordLogin}
                >
                    {t('loginDiscord')}
                </Button>
            </Show>
            <Show when={linkedUser()}>
                {(user) => (
                    <div class="my-2 flex items-center justify-between gap-2">
                        <p class="text-xs text-muted">
                            {t('discordLinkedAs')} <strong class="text-ink">{user().name}</strong>
                        </p>
                        <Button size="sm" icon={<LogOut size={14} />} onClick={discordLogout}>
                            {t('logoutDiscord')}
                        </Button>
                    </div>
                )}
            </Show>

            <Show when={state.authError}>
                {(message) => <p class="py-1 text-xs text-bad">{message()}</p>}
            </Show>

            <SettingRow label={t('settingQuestions')}>
                <Select
                    value={String(settings().questions)}
                    options={QUESTION_COUNTS.map((count) => ({
                        value: String(count),
                        label: String(count),
                    }))}
                    onChange={(value) => {
                        const parsed = QUESTION_COUNTS.find((c) => String(c) === value);
                        if (parsed) updateSettings({ questions: parsed });
                    }}
                />
            </SettingRow>

            <SettingRow label={t('settingSound')}>
                <Toggle
                    label={t('settingSound')}
                    checked={settings().sound}
                    onChange={(sound) => updateSettings({ sound })}
                />
            </SettingRow>

            <Show when={discordActivity.canSetActivity}>
                <SettingRow label={t('settingPresence')}>
                    <Toggle
                        label={t('settingPresence')}
                        checked={settings().discordPresence}
                        onChange={(discordPresence) => updateSettings({ discordPresence })}
                    />
                </SettingRow>
            </Show>

            <SettingRow label={t('settingAdaptive')}>
                <Toggle
                    label={t('settingAdaptive')}
                    checked={settings().adaptive}
                    onChange={(adaptive) => updateSettings({ adaptive })}
                />
            </SettingRow>

            <SettingRow label={t('settingDifficulty')}>
                <Select
                    value={settings().difficulty}
                    options={DIFFICULTY_FILTERS.map((value) => ({
                        value,
                        label: value === 'all' ? t('diffAll') : difficultyLabel(value),
                    }))}
                    onChange={(difficulty) => updateSettings({ difficulty })}
                />
            </SettingRow>

            <SettingRow label={t('settingTimer')}>
                <Select
                    value={String(settings().timer)}
                    options={TIMER_CHOICES.map((choice) => ({
                        value: String(choice),
                        label: choice === 'auto' ? t('timerAuto') : `${choice}s`,
                    }))}
                    onChange={(value) => {
                        const parsed = TIMER_CHOICES.find((c) => String(c) === value);
                        if (parsed !== undefined) updateSettings({ timer: parsed });
                    }}
                />
            </SettingRow>

            <SettingRow label={t('settingFeedbackDelay')}>
                <Select
                    value={String(settings().feedbackDelay)}
                    options={FEEDBACK_DELAYS.map((delay) => ({
                        value: String(delay),
                        label:
                            delay === 'manual'
                                ? t('feedbackManual')
                                : delay === 2
                                  ? t('feedback2')
                                  : delay === 4
                                    ? t('feedback4')
                                    : t('feedback6'),
                    }))}
                    onChange={(value) => {
                        const parsed = FEEDBACK_DELAYS.find((d) => String(d) === value);
                        if (parsed !== undefined) updateSettings({ feedbackDelay: parsed });
                    }}
                />
            </SettingRow>

            <Button
                variant="primary"
                block
                class="mt-3"
                onClick={() => {
                    if (!locked()) updateSettings({ name: sanitizeName(nameDraft()) });
                    closeDialog();
                }}
            >
                {t('save')}
            </Button>
        </Modal>
    );
};
