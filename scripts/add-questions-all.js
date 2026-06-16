'use strict';

/* Appends new questions across ALL banks. Validates:
   - languages: correctLanguage is playable + snippet is unique
   - MCQ banks: 4 options, answer is one of them, question is unique,
     category is from the bank's existing set, and en+ar everywhere. */

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'src', 'data');
const VALID_LANGS = ['Python', 'JavaScript', 'C++', 'Java', 'Rust', 'Go'];
const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase();

// ---------------------------------------------------------------- languages
const NEW_LANG = [
  { correctLanguage: 'Python', difficulty: 'medium',
    codeSnippet: 'from contextlib import suppress\nwith suppress(KeyError):\n    del d["x"]',
    explanation: { en: 'contextlib.suppress used as a with-statement context manager is Python.',
      ar: 'استخدام contextlib.suppress كمدير سياق مع with من بايثون.' } },
  { correctLanguage: 'Python', difficulty: 'hard',
    codeSnippet: 'results = await asyncio.gather(*tasks)',
    explanation: { en: 'await with asyncio.gather and * unpacking is Python async.',
      ar: 'await مع asyncio.gather وتفكيك * من بايثون غير المتزامن.' } },
  { correctLanguage: 'JavaScript', difficulty: 'medium',
    codeSnippet: 'const params = new URLSearchParams(location.search);',
    explanation: { en: 'Parsing location.search with URLSearchParams is browser JavaScript.',
      ar: 'تحليل location.search عبر URLSearchParams من جافاسكربت المتصفح.' } },
  { correctLanguage: 'JavaScript', difficulty: 'hard',
    codeSnippet: 'const results = await Promise.allSettled(promises);',
    explanation: { en: 'Promise.allSettled is a JavaScript promise combinator.',
      ar: 'Promise.allSettled مُجمِّع وعود في جافاسكربت.' } },
  { correctLanguage: 'C++', difficulty: 'medium',
    codeSnippet: 'auto [lo, hi] = std::minmax(a, b);',
    explanation: { en: 'Structured bindings with std::minmax are C++17.',
      ar: 'الربط البنيوي مع std::minmax من ++C17.' } },
  { correctLanguage: 'C++', difficulty: 'hard',
    codeSnippet: 'std::optional<int> result = find(key);',
    explanation: { en: 'std::optional for a maybe-absent value is C++17.',
      ar: 'std::optional لقيمة قد تكون غائبة من ++C17.' } },
  { correctLanguage: 'Java', difficulty: 'medium',
    codeSnippet: 'Stream.of(1, 2, 3).forEach(System.out::println);',
    explanation: { en: 'Stream.of with the System.out::println method reference is Java.',
      ar: 'Stream.of مع مرجع الدالة System.out::println من جافا.' } },
  { correctLanguage: 'Java', difficulty: 'hard',
    codeSnippet: 'Thread.ofVirtual().start(() -> task());',
    explanation: { en: 'Thread.ofVirtual() launches a virtual thread (Java 21).',
      ar: 'Thread.ofVirtual() يطلق خيطاً افتراضياً (جافا 21).' } },
  { correctLanguage: 'Rust', difficulty: 'medium',
    codeSnippet: 'let evens: i32 = (1..=100).filter(|n| n % 2 == 0).sum();',
    explanation: { en: 'An iterator chain with filter and a |n| closure is Rust.',
      ar: 'سلسلة مكرّرات مع filter وإغلاق |n| من رست.' } },
  { correctLanguage: 'Rust', difficulty: 'hard',
    codeSnippet: 'let shared = Arc::new(Mutex::new(0));',
    explanation: { en: 'Arc::new(Mutex::new(...)) for shared mutable state is Rust.',
      ar: 'Arc::new(Mutex::new(...)) للحالة المشتركة القابلة للتعديل من رست.' } },
  { correctLanguage: 'Go', difficulty: 'medium',
    codeSnippet: 'data, err := os.ReadFile("config.yaml")',
    explanation: { en: 'The data, err := pattern with os.ReadFile is Go.',
      ar: 'نمط data, err := مع os.ReadFile من Go.' } },
  { correctLanguage: 'Go', difficulty: 'hard',
    codeSnippet: 'start := time.Now()\nelapsed := time.Since(start)',
    explanation: { en: 'time.Now() with time.Since to measure elapsed time is Go.',
      ar: 'time.Now() مع time.Since لقياس الزمن المنقضي من Go.' } }
];

// --------------------------------------------------------------- cybersecurity
const NEW_CYBER = [
  { category: 'nmap', difficulty: 'medium', codeSnippet: 'nmap -p- 10.0.0.1',
    question: { en: 'What does the -p- flag scan?', ar: 'ماذا يفحص الخيار -p-؟' },
    options: ['All 65535 TCP ports', 'Only the top 100 ports', 'UDP ports only', 'Just port 80'],
    answer: 'All 65535 TCP ports',
    explanation: { en: '-p- tells Nmap to scan every TCP port from 1 to 65535.',
      ar: 'يطلب -p- من Nmap فحص كل منافذ TCP من 1 إلى 65535.' } },
  { category: 'nmap', difficulty: 'medium', codeSnippet: 'nmap -sn 192.168.1.0/24',
    question: { en: 'What does the -sn option do?', ar: 'ماذا يفعل الخيار -sn؟' },
    options: ['Host discovery without a port scan', 'A full SYN port scan', 'Service version detection', 'An aggressive OS scan'],
    answer: 'Host discovery without a port scan',
    explanation: { en: '-sn performs a ping sweep to find live hosts and skips port scanning.',
      ar: 'ينفّذ -sn مسحاً بالـ ping لاكتشاف المضيفات الحيّة دون فحص المنافذ.' } },
  { category: 'tools', difficulty: 'easy', codeSnippet: '',
    question: { en: 'Which tool captures and inspects network packets?', ar: 'أي أداة تلتقط وتحلّل حزم الشبكة؟' },
    options: ['Wireshark', 'Hydra', 'Nikto', 'John the Ripper'],
    answer: 'Wireshark',
    explanation: { en: 'Wireshark is the standard packet capture and protocol analysis tool.',
      ar: 'Wireshark هي الأداة المعيارية لالتقاط الحزم وتحليل البروتوكولات.' } },
  { category: 'tools', difficulty: 'medium', codeSnippet: 'hydra -l admin -P rockyou.txt ssh://10.0.0.5',
    question: { en: 'What is hydra doing in this command?', ar: 'ماذا تفعل hydra في هذا الأمر؟' },
    options: ['Brute-forcing the SSH login', 'Scanning for open ports', 'Sniffing SSH traffic', 'Exploiting a buffer overflow'],
    answer: 'Brute-forcing the SSH login',
    explanation: { en: 'hydra tries passwords from rockyou.txt against the SSH service for user admin.',
      ar: 'تجرّب hydra كلمات مرور من rockyou.txt ضد خدمة SSH للمستخدم admin.' } },
  { category: 'concepts', difficulty: 'easy', codeSnippet: '',
    question: { en: 'What does the CIA triad stand for in security?', ar: 'ماذا يعني ثالوث CIA في الأمن؟' },
    options: ['Confidentiality, Integrity, Availability', 'Control, Identity, Access', 'Cipher, Integrity, Authentication', 'Confidentiality, Identity, Auditing'],
    answer: 'Confidentiality, Integrity, Availability',
    explanation: { en: 'The CIA triad — Confidentiality, Integrity, Availability — is the core model of information security.',
      ar: 'ثالوث CIA — السرية والسلامة والتوافر — هو النموذج الأساسي لأمن المعلومات.' } },
  { category: 'concepts', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What is a zero-day vulnerability?', ar: 'ما هي ثغرة اليوم صفر (zero-day)؟' },
    options: ['A flaw unknown to the vendor with no patch yet', 'A bug fixed on the first day', 'An expired TLS certificate', 'A weak default password'],
    answer: 'A flaw unknown to the vendor with no patch yet',
    explanation: { en: 'A zero-day is a vulnerability unknown to the vendor, so no patch exists when it is exploited.',
      ar: 'ثغرة اليوم صفر غير معروفة للمطوّر، فلا يوجد تصحيح لها وقت استغلالها.' } },
  { category: 'concepts', difficulty: 'medium', codeSnippet: '',
    question: { en: 'Why is a salt added when hashing passwords?', ar: 'لماذا يُضاف salt عند تجزئة كلمات المرور؟' },
    options: ['To defeat precomputed rainbow-table attacks', 'To encrypt the password reversibly', 'To compress the hash', 'To speed up hashing'],
    answer: 'To defeat precomputed rainbow-table attacks',
    explanation: { en: 'A unique random salt makes identical passwords hash differently, defeating rainbow tables.',
      ar: 'يجعل الـ salt العشوائي كلمات المرور المتطابقة تُجزّأ بشكل مختلف، ما يبطل جداول rainbow.' } },
  { category: 'malware', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What distinguishes a worm from a virus?', ar: 'ما الذي يميّز الدودة عن الفيروس؟' },
    options: ['A worm self-replicates across networks without a host file', 'A worm needs a user to run a file', 'A worm only infects boot sectors', 'A worm cannot spread over a network'],
    answer: 'A worm self-replicates across networks without a host file',
    explanation: { en: 'Worms propagate on their own across networks; viruses attach to and need a host file.',
      ar: 'تنتشر الديدان ذاتياً عبر الشبكات، بينما يلتصق الفيروس بملف مضيف ويحتاجه.' } },
  { category: 'malware', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What is the primary goal of ransomware?', ar: 'ما الهدف الأساسي لبرمجيات الفدية؟' },
    options: ['Encrypt files and demand payment to decrypt them', 'Mine cryptocurrency silently', 'Log every keystroke only', 'Open a remote backdoor only'],
    answer: 'Encrypt files and demand payment to decrypt them',
    explanation: { en: 'Ransomware encrypts the victim’s data and demands payment for the decryption key.',
      ar: 'تشفّر برمجيات الفدية بيانات الضحية وتطلب فدية مقابل مفتاح فك التشفير.' } },
  { category: 'metasploit', difficulty: 'medium', codeSnippet: 'use exploit/windows/smb/ms17_010_eternalblue',
    question: { en: 'Which vulnerability does this Metasploit module exploit?', ar: 'أي ثغرة تستغلها وحدة Metasploit هذه؟' },
    options: ['EternalBlue (SMBv1)', 'Heartbleed (OpenSSL)', 'Shellshock (Bash)', 'Log4Shell (Log4j)'],
    answer: 'EternalBlue (SMBv1)',
    explanation: { en: 'ms17_010 is the EternalBlue exploit against the SMBv1 protocol.',
      ar: 'ms17_010 هي ثغرة EternalBlue ضد بروتوكول SMBv1.' } },
  { category: 'metasploit', difficulty: 'easy', codeSnippet: 'msfconsole',
    question: { en: 'What does msfconsole start?', ar: 'ماذا يشغّل msfconsole؟' },
    options: ['The Metasploit Framework console', 'A packet sniffer', 'A DNS server', 'A password vault'],
    answer: 'The Metasploit Framework console',
    explanation: { en: 'msfconsole is the main command-line interface to the Metasploit Framework.',
      ar: 'msfconsole هي الواجهة الرئيسية لسطر أوامر إطار Metasploit.' } },
  { category: 'concepts', difficulty: 'hard', codeSnippet: '',
    question: { en: 'In TLS, what is the role of a Certificate Authority (CA)?', ar: 'في TLS، ما دور سلطة الشهادات (CA)؟' },
    options: ['It signs certificates to vouch for a server’s public key', 'It encrypts all application data', 'It stores user passwords', 'It assigns IP addresses'],
    answer: 'It signs certificates to vouch for a server’s public key',
    explanation: { en: 'A CA digitally signs a server’s certificate, letting clients trust its public key.',
      ar: 'توقّع سلطة الشهادات شهادة الخادم رقمياً ليثق العملاء بمفتاحه العام.' } },
  { category: 'tools', difficulty: 'medium', codeSnippet: 'john --wordlist=rockyou.txt hashes.txt',
    question: { en: 'What is John the Ripper doing here?', ar: 'ماذا تفعل John the Ripper هنا؟' },
    options: ['Cracking password hashes using a wordlist', 'Scanning for vulnerabilities', 'Capturing packets', 'Encrypting the hashes file'],
    answer: 'Cracking password hashes using a wordlist',
    explanation: { en: 'John tries each word in rockyou.txt against the hashes to recover passwords.',
      ar: 'تجرّب John كل كلمة في rockyou.txt ضد التجزئات لاستعادة كلمات المرور.' } }
];

// ------------------------------------------------------------------- devops
const NEW_DEVOPS = [
  { category: 'docker', difficulty: 'easy', codeSnippet: 'docker ps -a',
    question: { en: 'What does docker ps -a show?', ar: 'ماذا يعرض docker ps -a؟' },
    options: ['All containers, including stopped ones', 'Only running containers', 'All images', 'All networks'],
    answer: 'All containers, including stopped ones',
    explanation: { en: 'docker ps -a lists every container, both running and stopped.',
      ar: 'يسرد docker ps -a كل الحاويات، العاملة والمتوقفة.' } },
  { category: 'docker', difficulty: 'medium', codeSnippet: 'docker logs -f web',
    question: { en: 'What does docker logs -f web do?', ar: 'ماذا يفعل docker logs -f web؟' },
    options: ['Streams (follows) the web container’s logs in real time', 'Deletes the web container', 'Restarts the web container', 'Lists the container’s files'],
    answer: 'Streams (follows) the web container’s logs in real time',
    explanation: { en: 'docker logs -f tails and follows the container’s stdout/stderr live.',
      ar: 'يتابع docker logs -f مخرجات الحاوية الحيّة لحظياً.' } },
  { category: 'docker', difficulty: 'medium', codeSnippet: 'docker compose up -d',
    question: { en: 'What does the -d flag do here?', ar: 'ماذا يفعل الخيار -d هنا؟' },
    options: ['Runs the containers in detached (background) mode', 'Deletes stopped containers', 'Enables debug logging', 'Disables networking'],
    answer: 'Runs the containers in detached (background) mode',
    explanation: { en: '-d (detached) starts the services in the background and returns control to the shell.',
      ar: 'يبدأ -d الخدمات في الخلفية ويعيد التحكم إلى الطرفية.' } },
  { category: 'kubernetes', difficulty: 'easy', codeSnippet: 'kubectl get pods',
    question: { en: 'What does kubectl get pods list?', ar: 'ماذا يسرد kubectl get pods؟' },
    options: ['Pods in the current namespace', 'All cluster nodes', 'Container images', 'Stored secrets'],
    answer: 'Pods in the current namespace',
    explanation: { en: 'It lists the pods running in the currently selected namespace.',
      ar: 'يسرد الـ pods العاملة في مساحة الأسماء الحالية.' } },
  { category: 'kubernetes', difficulty: 'medium', codeSnippet: 'kubectl scale deployment web --replicas=5',
    question: { en: 'What does this command do?', ar: 'ماذا يفعل هذا الأمر؟' },
    options: ['Sets the deployment to run 5 pod replicas', 'Creates 5 new deployments', 'Limits the pod to 5 CPUs', 'Rolls back 5 revisions'],
    answer: 'Sets the deployment to run 5 pod replicas',
    explanation: { en: 'kubectl scale adjusts the "web" deployment to maintain 5 running pod replicas.',
      ar: 'يضبط kubectl scale نشر "web" للحفاظ على 5 نسخ pod عاملة.' } },
  { category: 'kubernetes', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What is a Kubernetes Service used for?', ar: 'فيمَ يُستخدم Service في Kubernetes؟' },
    options: ['Exposing a stable network endpoint for a set of pods', 'Storing persistent data', 'Building container images', 'Scheduling cron jobs'],
    answer: 'Exposing a stable network endpoint for a set of pods',
    explanation: { en: 'A Service gives a stable IP/DNS name and load-balances traffic to matching pods.',
      ar: 'يمنح Service عنوان IP/DNS ثابتاً ويوزّع الحِمل على الـ pods المطابقة.' } },
  { category: 'kubernetes', difficulty: 'hard', codeSnippet: '',
    question: { en: 'What does a liveness probe do in Kubernetes?', ar: 'ماذا يفعل فحص liveness في Kubernetes؟' },
    options: ['Restarts a container when its health check fails', 'Delays pod startup', 'Scales the deployment up', 'Encrypts pod traffic'],
    answer: 'Restarts a container when its health check fails',
    explanation: { en: 'If a liveness probe fails, the kubelet restarts the container to recover it.',
      ar: 'إذا فشل فحص liveness، يعيد kubelet تشغيل الحاوية لاستعادتها.' } },
  { category: 'cicd', difficulty: 'easy', codeSnippet: '',
    question: { en: 'What does CI stand for in DevOps?', ar: 'ماذا تعني CI في DevOps؟' },
    options: ['Continuous Integration', 'Container Image', 'Cloud Infrastructure', 'Code Inspection'],
    answer: 'Continuous Integration',
    explanation: { en: 'CI is Continuous Integration — merging and testing code changes frequently.',
      ar: 'CI تعني التكامل المستمر — دمج واختبار تغييرات الشيفرة بشكل متكرر.' } },
  { category: 'cicd', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What is the main purpose of a CI pipeline?', ar: 'ما الغرض الرئيسي من خط أنابيب CI؟' },
    options: ['Automatically build and test code on each change', 'Manually deploy to production', 'Store secrets securely', 'Monitor server uptime'],
    answer: 'Automatically build and test code on each change',
    explanation: { en: 'A CI pipeline automatically builds and runs tests whenever code changes, catching issues early.',
      ar: 'يبني خط CI ويشغّل الاختبارات تلقائياً عند كل تغيير، فيكتشف المشاكل مبكراً.' } },
  { category: 'iac', difficulty: 'medium', codeSnippet: 'terraform apply',
    question: { en: 'What does terraform apply do?', ar: 'ماذا يفعل terraform apply؟' },
    options: ['Provisions infrastructure to match the configuration', 'Only previews changes', 'Deletes all resources', 'Formats the code'],
    answer: 'Provisions infrastructure to match the configuration',
    explanation: { en: 'terraform apply creates or updates real infrastructure to match the declared configuration.',
      ar: 'ينشئ terraform apply أو يحدّث البنية الحقيقية لتطابق الإعداد المعلن.' } },
  { category: 'iac', difficulty: 'medium', codeSnippet: 'terraform plan',
    question: { en: 'What does terraform plan show?', ar: 'ماذا يعرض terraform plan؟' },
    options: ['A preview of changes without applying them', 'The current cloud bill', 'Live server metrics', 'The git history'],
    answer: 'A preview of changes without applying them',
    explanation: { en: 'terraform plan shows what would change, without modifying any infrastructure.',
      ar: 'يعرض terraform plan ما سيتغيّر دون تعديل أي بنية.' } },
  { category: 'cloud', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What is the main benefit of autoscaling?', ar: 'ما الفائدة الأساسية من التوسّع التلقائي (autoscaling)؟' },
    options: ['Capacity automatically matches demand', 'Code never needs testing', 'Servers never restart', 'Storage becomes free'],
    answer: 'Capacity automatically matches demand',
    explanation: { en: 'Autoscaling adds or removes capacity automatically as load rises and falls.',
      ar: 'يضيف التوسّع التلقائي السعة أو يزيلها تلقائياً مع ارتفاع الحِمل وانخفاضه.' } },
  { category: 'cloud', difficulty: 'easy', codeSnippet: '',
    question: { en: 'What does "serverless" mean?', ar: 'ماذا تعني "بلا خادم" (serverless)؟' },
    options: ['You run code without managing servers', 'There are literally no servers', 'It only runs on your laptop', 'It cannot scale'],
    answer: 'You run code without managing servers',
    explanation: { en: 'Serverless means the provider manages the servers; you just deploy code that runs on demand.',
      ar: 'يعني serverless أن المزوّد يدير الخوادم، وأنت تنشر شيفرة تعمل عند الطلب.' } }
];

// ------------------------------------------------------------------ network
const NEW_NETWORK = [
  { category: 'osi', difficulty: 'medium', codeSnippet: '',
    question: { en: 'At which OSI layer does a router primarily operate?', ar: 'في أي طبقة OSI يعمل الموجّه أساساً؟' },
    options: ['Layer 3 (Network)', 'Layer 2 (Data Link)', 'Layer 4 (Transport)', 'Layer 7 (Application)'],
    answer: 'Layer 3 (Network)',
    explanation: { en: 'Routers forward packets based on IP addresses at Layer 3, the Network layer.',
      ar: 'توجّه الموجّهات الحزم بناءً على عناوين IP في الطبقة 3، طبقة الشبكة.' } },
  { category: 'osi', difficulty: 'medium', codeSnippet: '',
    question: { en: 'Which OSI layer uses MAC addresses?', ar: 'أي طبقة OSI تستخدم عناوين MAC؟' },
    options: ['Layer 2 (Data Link)', 'Layer 1 (Physical)', 'Layer 3 (Network)', 'Layer 5 (Session)'],
    answer: 'Layer 2 (Data Link)',
    explanation: { en: 'MAC addressing and switching happen at Layer 2, the Data Link layer.',
      ar: 'تحدث عنونة MAC والتبديل في الطبقة 2، طبقة ربط البيانات.' } },
  { category: 'tcp', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What is the correct order of the TCP three-way handshake?', ar: 'ما الترتيب الصحيح لمصافحة TCP الثلاثية؟' },
    options: ['SYN, SYN-ACK, ACK', 'ACK, SYN, FIN', 'SYN, ACK, SYN', 'FIN, ACK, RST'],
    answer: 'SYN, SYN-ACK, ACK',
    explanation: { en: 'TCP establishes a connection with SYN, then SYN-ACK, then ACK.',
      ar: 'ينشئ TCP الاتصال عبر SYN ثم SYN-ACK ثم ACK.' } },
  { category: 'tcp', difficulty: 'easy', codeSnippet: '',
    question: { en: 'TCP is best described as?', ar: 'كيف يُوصف TCP بدقّة؟' },
    options: ['Connection-oriented and reliable', 'Connectionless and unreliable', 'Encrypted by default', 'A routing protocol'],
    answer: 'Connection-oriented and reliable',
    explanation: { en: 'TCP is connection-oriented and guarantees ordered, reliable delivery.',
      ar: 'TCP موجّه بالاتصال ويضمن تسليماً مرتّباً وموثوقاً.' } },
  { category: 'ip', difficulty: 'easy', codeSnippet: '',
    question: { en: 'What is the IPv4 loopback address?', ar: 'ما عنوان الاسترجاع (loopback) في IPv4؟' },
    options: ['127.0.0.1', '192.168.0.1', '10.0.0.1', '255.255.255.255'],
    answer: '127.0.0.1',
    explanation: { en: '127.0.0.1 (localhost) always refers to the local machine.',
      ar: 'يشير 127.0.0.1 (localhost) دائماً إلى الجهاز المحلي.' } },
  { category: 'ip', difficulty: 'medium', codeSnippet: '192.168.1.0/24',
    question: { en: 'How many usable host addresses does a /24 subnet have?', ar: 'كم عدد عناوين المضيفات القابلة للاستخدام في شبكة /24؟' },
    options: ['254', '256', '128', '510'],
    answer: '254',
    explanation: { en: 'A /24 has 256 addresses; minus the network and broadcast addresses leaves 254 usable hosts.',
      ar: 'تحوي /24 على 256 عنواناً؛ بطرح عنواني الشبكة والبث يتبقّى 254 مضيفاً قابلاً للاستخدام.' } },
  { category: 'ip', difficulty: 'medium', codeSnippet: '',
    question: { en: 'Which range is a private (RFC 1918) address block?', ar: 'أي نطاق هو كتلة عناوين خاصة (RFC 1918)؟' },
    options: ['10.0.0.0/8', '8.8.8.0/24', '1.1.1.0/24', '172.0.0.0/8'],
    answer: '10.0.0.0/8',
    explanation: { en: '10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16 are the private RFC 1918 ranges.',
      ar: 'النطاقات 10.0.0.0/8 و172.16.0.0/12 و192.168.0.0/16 هي نطاقات RFC 1918 الخاصة.' } },
  { category: 'dns', difficulty: 'easy', codeSnippet: '',
    question: { en: 'What does a DNS A record map?', ar: 'ماذا يربط سجل DNS من نوع A؟' },
    options: ['A hostname to an IPv4 address', 'A hostname to a MAC address', 'An IP to a port', 'A domain to an email server'],
    answer: 'A hostname to an IPv4 address',
    explanation: { en: 'An A record maps a domain name to an IPv4 address.',
      ar: 'يربط سجل A اسم النطاق بعنوان IPv4.' } },
  { category: 'dns', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What does a CNAME record do?', ar: 'ماذا يفعل سجل CNAME؟' },
    options: ['Aliases one domain name to another', 'Maps a name to an IPv6 address', 'Specifies a mail server', 'Stores an arbitrary text value'],
    answer: 'Aliases one domain name to another',
    explanation: { en: 'A CNAME makes one hostname an alias of another canonical name.',
      ar: 'يجعل CNAME اسم مضيف مرادفاً لاسم قانوني آخر.' } },
  { category: 'protocols', difficulty: 'easy', codeSnippet: '',
    question: { en: 'Which protocol secures HTTPS connections?', ar: 'أي بروتوكول يؤمّن اتصالات HTTPS؟' },
    options: ['TLS', 'FTP', 'ICMP', 'ARP'],
    answer: 'TLS',
    explanation: { en: 'HTTPS layers HTTP over TLS for encryption and authentication.',
      ar: 'يضع HTTPS طبقة HTTP فوق TLS للتشفير والمصادقة.' } },
  { category: 'protocols', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What is the default port for HTTPS?', ar: 'ما المنفذ الافتراضي لـ HTTPS؟' },
    options: ['443', '80', '22', '8080'],
    answer: '443',
    explanation: { en: 'HTTPS uses TCP port 443 by default.',
      ar: 'يستخدم HTTPS منفذ TCP رقم 443 افتراضياً.' } },
  { category: 'routing', difficulty: 'medium', codeSnippet: '',
    question: { en: 'What does NAT (Network Address Translation) do?', ar: 'ماذا يفعل NAT (ترجمة عناوين الشبكة)؟' },
    options: ['Maps private IPs to a public IP', 'Encrypts all traffic', 'Resolves domain names', 'Assigns MAC addresses'],
    answer: 'Maps private IPs to a public IP',
    explanation: { en: 'NAT lets many devices with private IPs share one public IP for internet access.',
      ar: 'يتيح NAT لأجهزة كثيرة بعناوين خاصة مشاركة عنوان عام واحد للوصول إلى الإنترنت.' } }
];

// ---------------------------------------------------------------- validation
const errors = [];

function checkBilingual(obj, label) {
  if (!obj || !obj.en || !obj.ar) errors.push(`${label}: missing en/ar`);
}

function appendLang(file, items) {
  const full = path.join(DATA, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
  const existing = new Set(data.map((q) => norm(q.codeSnippet)));
  const seen = new Set();
  for (const q of items) {
    if (!VALID_LANGS.includes(q.correctLanguage)) errors.push(`lang: invalid language ${q.correctLanguage}`);
    const k = norm(q.codeSnippet);
    if (existing.has(k)) errors.push(`lang: duplicate of existing snippet: ${q.codeSnippet}`);
    if (seen.has(k)) errors.push(`lang: duplicate within batch: ${q.codeSnippet}`);
    seen.add(k);
    checkBilingual(q.explanation, 'lang explanation');
  }
  return { full, data, items };
}

function appendMCQ(file, items, allowedCats) {
  const full = path.join(DATA, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf-8'));
  // A question is a true duplicate only if BOTH its prompt and its snippet match
  // (the bank reuses generic prompts like "What does this command do?").
  const key = (q) => norm(q.question.en) + '||' + norm(q.codeSnippet);
  const existingQ = new Set(data.map(key));
  const seen = new Set();
  for (const q of items) {
    if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${file}: options must be 4 — ${q.question.en}`);
    if (new Set(q.options).size !== q.options.length) errors.push(`${file}: duplicate options — ${q.question.en}`);
    if (!q.options.includes(q.answer)) errors.push(`${file}: answer not in options — ${q.question.en}`);
    if (allowedCats && !allowedCats.includes(q.category)) errors.push(`${file}: unknown category ${q.category}`);
    checkBilingual(q.question, `${file} question`);
    checkBilingual(q.explanation, `${file} explanation`);
    const k = key(q);
    if (existingQ.has(k)) errors.push(`${file}: duplicate question+snippet: ${q.question.en}`);
    if (seen.has(k)) errors.push(`${file}: duplicate within batch: ${q.question.en} / ${q.codeSnippet}`);
    seen.add(k);
  }
  return { full, data, items };
}

const jobs = [
  appendLang('questions.json', NEW_LANG),
  appendMCQ('questions-cyber.json', NEW_CYBER, ['nmap', 'malware', 'metasploit', 'tools', 'concepts']),
  appendMCQ('questions-devops.json', NEW_DEVOPS, ['docker', 'kubernetes', 'cicd', 'iac', 'cloud']),
  appendMCQ('questions-network.json', NEW_NETWORK, ['osi', 'tcp', 'ip', 'dns', 'protocols', 'routing'])
];

if (errors.length) {
  console.error('VALIDATION FAILED:\n' + errors.join('\n'));
  process.exit(1);
}

// ---------------------------------------------------------------- write out
let grandTotal = 0;
for (const job of jobs) {
  let nextId = Math.max(...job.data.map((q) => q.id)) + 1;
  const appended = job.items.map((q) => Object.assign({ id: nextId++ }, q));
  const merged = job.data.concat(appended);
  fs.writeFileSync(job.full, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  grandTotal += appended.length;
  console.log(`${path.basename(job.full)}: +${appended.length} (ids ${appended[0].id}-${appended[appended.length - 1].id}) -> ${merged.length} total`);
}
console.log(`\nGRAND TOTAL ADDED: ${grandTotal}`);
