export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  email?: string;
  tags: string[];
  notes?: string;
}

export interface Message {
  id: string;
  text: string;
  timestamp: string;
  sender: 'customer' | 'agent';
  status?: 'sent' | 'delivered' | 'read';
}

export interface Conversation {
  id: string;
  contact: Contact;
  messages: Message[];
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'active' | 'pending' | 'resolved';
}

export const conversations: Conversation[] = [
  {
    id: '1',
    contact: {
      id: 'c1',
      name: 'أحمد محمد',
      phone: '+201012345678',
      email: 'ahmed@example.com',
      tags: ['عميل VIP', 'القاهرة'],
      notes: 'عميل مميز - يفضل التواصل صباحاً',
    },
    messages: [
      { id: 'm1', text: 'السلام عليكم، عايز أستفسر عن المنتج الجديد', timestamp: '10:30 ص', sender: 'customer', status: 'read' },
      { id: 'm2', text: 'وعليكم السلام يا أحمد! أهلاً بيك 😊 المنتج الجديد متوفر حالياً بثلاث ألوان', timestamp: '10:32 ص', sender: 'agent', status: 'read' },
      { id: 'm3', text: 'تمام، ممكن تبعتلي الأسعار؟', timestamp: '10:33 ص', sender: 'customer', status: 'read' },
      { id: 'm4', text: 'طبعاً! السعر يبدأ من 500 جنيه. عايز تعرف تفاصيل أكتر؟', timestamp: '10:35 ص', sender: 'agent', status: 'delivered' },
    ],
    lastMessage: 'طبعاً! السعر يبدأ من 500 جنيه',
    lastMessageTime: '10:35 ص',
    unreadCount: 0,
    status: 'active',
  },
  {
    id: '2',
    contact: {
      id: 'c2',
      name: 'فاطمة علي',
      phone: '+201098765432',
      tags: ['استفسار', 'الإسكندرية'],
    },
    messages: [
      { id: 'm5', text: 'مساء الخير، عندي مشكلة في الطلب رقم #1234', timestamp: '2:15 م', sender: 'customer', status: 'read' },
      { id: 'm6', text: 'مساء النور يا فاطمة. خليني أراجع الطلب وأرد عليكي', timestamp: '2:20 م', sender: 'agent', status: 'read' },
      { id: 'm7', text: 'شكراً، مستنية ردكم', timestamp: '2:21 م', sender: 'customer' },
    ],
    lastMessage: 'شكراً، مستنية ردكم',
    lastMessageTime: '2:21 م',
    unreadCount: 1,
    status: 'pending',
  },
  {
    id: '3',
    contact: {
      id: 'c3',
      name: 'محمود حسن',
      phone: '+201155556666',
      tags: ['شكوى', 'المنصورة'],
    },
    messages: [
      { id: 'm8', text: 'الطلب اتأخر عن الموعد المحدد', timestamp: '9:00 ص', sender: 'customer' },
      { id: 'm9', text: 'نعتذر عن التأخير. تم التنسيق مع شركة الشحن وهيوصلك النهارده إن شاء الله', timestamp: '9:15 ص', sender: 'agent', status: 'sent' },
    ],
    lastMessage: 'تم التنسيق مع شركة الشحن',
    lastMessageTime: '9:15 ص',
    unreadCount: 0,
    status: 'resolved',
  },
  {
    id: '4',
    contact: {
      id: 'c4',
      name: 'سارة أحمد',
      phone: '+201234567890',
      email: 'sara@example.com',
      tags: ['عميل جديد'],
    },
    messages: [
      { id: 'm10', text: 'أهلاً، عايزة أعرف طرق الدفع المتاحة', timestamp: '11:00 ص', sender: 'customer' },
    ],
    lastMessage: 'عايزة أعرف طرق الدفع المتاحة',
    lastMessageTime: '11:00 ص',
    unreadCount: 1,
    status: 'active',
  },
  {
    id: '5',
    contact: {
      id: 'c5',
      name: 'خالد إبراهيم',
      phone: '+201177778888',
      tags: ['موزع', 'الجيزة'],
      notes: 'موزع معتمد - منطقة الجيزة',
    },
    messages: [
      { id: 'm11', text: 'محتاج أطلب كمية من المنتج الجديد', timestamp: 'أمس', sender: 'customer' },
      { id: 'm12', text: 'أهلاً خالد. الكمية المتاحة حالياً 500 قطعة', timestamp: 'أمس', sender: 'agent', status: 'read' },
      { id: 'm13', text: 'تمام هاخد 200 قطعة', timestamp: 'أمس', sender: 'customer' },
      { id: 'm14', text: 'تم تسجيل الطلب. هيتم التوصيل خلال 3 أيام عمل', timestamp: 'أمس', sender: 'agent', status: 'read' },
      { id: 'm15', text: 'ممتاز شكراً ليكم 👍', timestamp: 'أمس', sender: 'customer' },
    ],
    lastMessage: 'ممتاز شكراً ليكم 👍',
    lastMessageTime: 'أمس',
    unreadCount: 0,
    status: 'resolved',
  },
  {
    id: '6',
    contact: {
      id: 'c6',
      name: 'نورهان السيد',
      phone: '+201299887766',
      email: 'nourhan@example.com',
      tags: ['طلب جديد', 'أسيوط'],
    },
    messages: [
      { id: 'm16', text: 'السلام عليكم، هل المنتج ده متوفر باللون الأزرق؟', timestamp: '3:45 م', sender: 'customer' },
      { id: 'm17', text: 'وعليكم السلام! أيوه متوفر. عايزة تطلبي؟', timestamp: '3:50 م', sender: 'agent', status: 'read' },
      { id: 'm18', text: 'أيوه عايزة قطعتين لو سمحت', timestamp: '3:52 م', sender: 'customer' },
    ],
    lastMessage: 'أيوه عايزة قطعتين لو سمحت',
    lastMessageTime: '3:52 م',
    unreadCount: 1,
    status: 'active',
  },
];

export const chartData = [
  { name: 'سبت', messages: 45, responses: 40 },
  { name: 'أحد', messages: 78, responses: 72 },
  { name: 'إثنين', messages: 120, responses: 110 },
  { name: 'ثلاثاء', messages: 95, responses: 88 },
  { name: 'أربعاء', messages: 150, responses: 140 },
  { name: 'خميس', messages: 130, responses: 125 },
  { name: 'جمعة', messages: 60, responses: 55 },
];
