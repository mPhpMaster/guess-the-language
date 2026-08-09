import type { ModeId } from './types';
import type { Lang } from '$lib/i18n/dictionary';

export interface ModeMeta {
  key: ModeId;
  icon: string;
  /** Two-part heading: the second half renders in the neon gradient. */
  title: Record<Lang, readonly [string, string]>;
  desc: Record<Lang, string>;
}

export const MODES: Record<ModeId, ModeMeta> = {
  languages: {
    key: 'languages',
    icon: '💻',
    title: { en: ['Guess the', 'Programming Language'], ar: ['خمِّن', 'لغة البرمجة'] },
    desc: {
      en: 'Identify the language from the snippet before time runs out',
      ar: 'خمّن لغة البرمجة من مقتطف الكود قبل انتهاء الوقت'
    }
  },
  cybersecurity: {
    key: 'cybersecurity',
    icon: '🛡️',
    title: { en: ['Cyber', 'Security Quiz'], ar: ['اختبار', 'الأمن السيبراني'] },
    desc: {
      en: 'Identify tools, malware, Nmap, Metasploit & more',
      ar: 'تعرّف على الأدوات والبرمجيات الخبيثة وNmap وMetasploit والمزيد'
    }
  },
  devops: {
    key: 'devops',
    icon: '♾️',
    title: { en: ['DevOps', 'Quiz'], ar: ['اختبار', 'DevOps'] },
    desc: {
      en: 'Docker, Kubernetes, CI/CD, Git, Terraform & cloud',
      ar: 'Docker وKubernetes وCI/CD وGit وTerraform والسحابة'
    }
  },
  network: {
    key: 'network',
    icon: '🌐',
    title: { en: ['Networking', 'Quiz'], ar: ['اختبار', 'الشبكات'] },
    desc: {
      en: 'OSI, TCP/IP, DNS, routing, subnetting & protocols',
      ar: 'OSI وTCP/IP وDNS والتوجيه والتقسيم والبروتوكولات'
    }
  },
  gamedev: {
    key: 'gamedev',
    icon: '🎮',
    title: { en: ['Game', 'Dev Quiz'], ar: ['اختبار', 'تطوير الألعاب'] },
    desc: {
      en: 'Game loops, physics, rendering, assets and UI systems',
      ar: 'حلقات الألعاب والفيزياء والرسوم والمحتوى والواجهات'
    }
  },
  algorithms: {
    key: 'algorithms',
    icon: '🧩',
    title: { en: ['Problem', 'Solving Quiz'], ar: ['اختبار', 'حل المشكلات'] },
    desc: {
      en: 'Fill in the blank: algorithms, data structures & Big-O',
      ar: 'املأ الفراغ: الخوارزميات وهياكل البيانات وتعقيد الوقت'
    }
  },
  all: {
    key: 'all',
    icon: '🎲',
    title: { en: ['All', 'Mixed Quiz'], ar: ['الكل', 'اختبار شامل'] },
    desc: { en: 'Everything mixed: all six banks together', ar: 'كل شيء مدمج: البنوك الستة معاً' }
  }
};

export function modeMeta(id: ModeId): ModeMeta {
  return MODES[id] ?? MODES.languages;
}
