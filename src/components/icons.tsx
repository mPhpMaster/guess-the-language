import type { Component, JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import Play from 'lucide-solid/icons/play';
import House from 'lucide-solid/icons/house';
import Link from 'lucide-solid/icons/link';
import Users from 'lucide-solid/icons/users';
import SettingsIcon from 'lucide-solid/icons/settings';
import ShieldHalf from 'lucide-solid/icons/shield-half';
import GraduationCap from 'lucide-solid/icons/graduation-cap';
import CalendarDays from 'lucide-solid/icons/calendar-days';
import RotateCw from 'lucide-solid/icons/rotate-cw';
import Undo2 from 'lucide-solid/icons/undo-2';
import Camera from 'lucide-solid/icons/camera';
import Share2 from 'lucide-solid/icons/share-2';
import Trophy from 'lucide-solid/icons/trophy';
import Medal from 'lucide-solid/icons/medal';
import Award from 'lucide-solid/icons/award';
import Flame from 'lucide-solid/icons/flame';
import Zap from 'lucide-solid/icons/zap';
import Timer from 'lucide-solid/icons/timer';
import Rocket from 'lucide-solid/icons/rocket';
import Crown from 'lucide-solid/icons/crown';
import Sparkles from 'lucide-solid/icons/sparkles';
import Star from 'lucide-solid/icons/star';
import Repeat from 'lucide-solid/icons/repeat';
import Hash from 'lucide-solid/icons/hash';
import Gamepad2 from 'lucide-solid/icons/gamepad-2';
import Info from 'lucide-solid/icons/info';
import X from 'lucide-solid/icons/x';
import Check from 'lucide-solid/icons/check';
import Minus from 'lucide-solid/icons/minus';
import Plus from 'lucide-solid/icons/plus';
import Globe from 'lucide-solid/icons/globe';
import CpuIcon from 'lucide-solid/icons/cpu';
import NetworkIcon from 'lucide-solid/icons/network';
import Code from 'lucide-solid/icons/code';
import Dice5 from 'lucide-solid/icons/dice-5';
import Puzzle from 'lucide-solid/icons/puzzle';
import InfinityIcon from 'lucide-solid/icons/infinity';
import UserRound from 'lucide-solid/icons/user-round';
import LogOut from 'lucide-solid/icons/log-out';
import MessageCircle from 'lucide-solid/icons/message-circle';
import Eye from 'lucide-solid/icons/eye';
import Clock from 'lucide-solid/icons/clock';
import CircleAlert from 'lucide-solid/icons/circle-alert';
import Search from 'lucide-solid/icons/search';
import Ban from 'lucide-solid/icons/ban';
import Trash2 from 'lucide-solid/icons/trash-2';
import UserX from 'lucide-solid/icons/user-x';
import RefreshCw from 'lucide-solid/icons/refresh-cw';
import Download from 'lucide-solid/icons/download';
import Copy from 'lucide-solid/icons/copy';
import ExternalLink from 'lucide-solid/icons/external-link';
import ImageIcon from 'lucide-solid/icons/image';
import CircleHelp from 'lucide-solid/icons/circle-help';
import Lock from 'lucide-solid/icons/lock';
import UserPlus from 'lucide-solid/icons/user-plus';
import CircleCheck from 'lucide-solid/icons/circle-check';
import Flag from 'lucide-solid/icons/flag';
import TriangleAlert from 'lucide-solid/icons/triangle-alert';
import Database from 'lucide-solid/icons/database';
import Terminal from 'lucide-solid/icons/terminal';
import Braces from 'lucide-solid/icons/braces';
import Monitor from 'lucide-solid/icons/monitor';
import ChevronLeft from 'lucide-solid/icons/chevron-left';

import {
    SiPython,
    SiJavascript,
    SiTypescript,
    SiCplusplus,
    SiC,
    SiDotnet,
    SiOpenjdk,
    SiKotlin,
    SiSwift,
    SiRust,
    SiGo,
    SiRuby,
    SiPhp,
    SiGnubash,
    SiGithub,
    SiDiscord,
} from 'solid-icons/si';

import type { GameMode } from '../types/models';

/* ============================================================
   Icon registry. The app renders components from icon packages
   only — there is no emoji anywhere in the UI.
   ============================================================ */

export {
    Play,
    House,
    Link,
    Users,
    SettingsIcon,
    ShieldHalf,
    GraduationCap,
    CalendarDays,
    RotateCw,
    Undo2,
    Camera,
    Share2,
    Trophy,
    Medal,
    Award,
    Flame,
    Zap,
    Timer,
    Rocket,
    Crown,
    Sparkles,
    Star,
    Repeat,
    Hash,
    Gamepad2,
    Info,
    X,
    Check,
    Minus,
    Plus,
    Globe,
    Code,
    Dice5,
    Puzzle,
    InfinityIcon,
    UserRound,
    LogOut,
    MessageCircle,
    Eye,
    Clock,
    CircleAlert,
    Search,
    Ban,
    Trash2,
    UserX,
    RefreshCw,
    Download,
    Copy,
    ExternalLink,
    ImageIcon,
    CircleHelp,
    Lock,
    UserPlus,
    CircleCheck,
    Flag,
    TriangleAlert,
    Database,
    Terminal,
    Monitor,
    ChevronLeft,
    NetworkIcon,
    CpuIcon,
    Braces,
    SiDiscord,
    SiGithub,
};

/** Every lucide icon accepts the same prop shape. */
export interface IconProps {
    readonly size?: number;
    readonly class?: string;
    readonly 'aria-hidden'?: boolean;
}

type IconComponent = Component<IconProps>;

const MODE_ICONS: Readonly<Record<GameMode, IconComponent>> = {
    languages: Code as IconComponent,
    cybersecurity: ShieldHalf as IconComponent,
    devops: InfinityIcon as IconComponent,
    network: NetworkIcon as IconComponent,
    gamedev: Gamepad2 as IconComponent,
    algorithms: Puzzle as IconComponent,
    all: Dice5 as IconComponent,
};

export const ModeIcon: Component<{ readonly mode: GameMode; readonly size?: number; readonly class?: string }> = (
    props,
) => (
    <Dynamic
        component={MODE_ICONS[props.mode]}
        size={props.size ?? 24}
        class={props.class ?? ''}
        aria-hidden={true}
    />
);

/** Brand marks for the "guess the language" answer buttons. */
const LANGUAGE_ICONS: Readonly<Record<string, IconComponent>> = {
    python: SiPython as unknown as IconComponent,
    javascript: SiJavascript as unknown as IconComponent,
    typescript: SiTypescript as unknown as IconComponent,
    cplusplus: SiCplusplus as unknown as IconComponent,
    c: SiC as unknown as IconComponent,
    csharp: SiDotnet as unknown as IconComponent,
    java: SiOpenjdk as unknown as IconComponent,
    kotlin: SiKotlin as unknown as IconComponent,
    swift: SiSwift as unknown as IconComponent,
    rust: SiRust as unknown as IconComponent,
    go: SiGo as unknown as IconComponent,
    ruby: SiRuby as unknown as IconComponent,
    php: SiPhp as unknown as IconComponent,
    sql: Database as IconComponent,
    bash: SiGnubash as unknown as IconComponent,
    unknown: CircleHelp as IconComponent,
};

export const LanguageIcon: Component<{
    readonly iconKey: string | undefined;
    readonly size?: number;
}> = (props) => (
    <Dynamic
        component={LANGUAGE_ICONS[props.iconKey ?? 'unknown'] ?? (CircleHelp as IconComponent)}
        size={props.size ?? 22}
        aria-hidden={true}
    />
);

/** Achievement badges, keyed by `AchievementDefinition.iconKey`. */
const ACHIEVEMENT_ICONS: Readonly<Record<string, IconComponent>> = {
    gamepad: Gamepad2 as IconComponent,
    repeat: Repeat as IconComponent,
    hash: Hash as IconComponent,
    medal: Medal as IconComponent,
    trophy: Trophy as IconComponent,
    sparkle: Sparkles as IconComponent,
    star: Star as IconComponent,
    flame: Flame as IconComponent,
    zap: Zap as IconComponent,
    timer: Timer as IconComponent,
    rocket: Rocket as IconComponent,
    crown: Crown as IconComponent,
};

export const AchievementIcon: Component<{
    readonly iconKey: string;
    readonly size?: number;
}> = (props) => (
    <Dynamic
        component={ACHIEVEMENT_ICONS[props.iconKey] ?? (Award as IconComponent)}
        size={props.size ?? 20}
        aria-hidden={true}
    />
);

/** Rank badge for the top three leaderboard rows (gold / silver / bronze). */
export const RankBadge: Component<{ readonly rank: number }> = (props) => {
    const tone = (): string =>
        props.rank === 1
            ? 'text-gold'
            : props.rank === 2
              ? 'text-silver'
              : 'text-bronze';
    return (
        <span class={tone()} aria-hidden="true">
            <Medal size={16} />
        </span>
    );
};

export type IconElement = JSX.Element;
