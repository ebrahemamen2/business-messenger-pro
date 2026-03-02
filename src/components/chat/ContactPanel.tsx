import { Mail, Phone, Tag, FileText, X } from 'lucide-react';
import type { Contact } from '@/data/mockData';

interface ContactPanelProps {
  contact: Contact;
  onClose: () => void;
}

const ContactPanel = ({ contact, onClose }: ContactPanelProps) => {
  return (
    <div className="w-[300px] h-full border-l border-border bg-card flex-shrink-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">معلومات العميل</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Profile */}
      <div className="p-6 text-center border-b border-border">
        <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl font-bold text-primary">
            {contact.name.charAt(0)}
          </span>
        </div>
        <h3 className="font-bold text-foreground text-lg">{contact.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{contact.phone}</p>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Phone */}
        <div className="flex items-start gap-3">
          <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">رقم الهاتف</p>
            <p className="text-sm text-foreground" dir="ltr">
              {contact.phone}
            </p>
          </div>
        </div>

        {/* Email */}
        {contact.email && (
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">البريد الإلكتروني</p>
              <p className="text-sm text-foreground">{contact.email}</p>
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="flex items-start gap-3">
          <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1.5">التصنيفات</p>
            <div className="flex flex-wrap gap-1.5">
              {contact.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        {contact.notes && (
          <div className="flex items-start gap-3">
            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1.5">ملاحظات</p>
              <p className="text-sm text-foreground bg-secondary p-3 rounded-lg leading-relaxed">
                {contact.notes}
              </p>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground font-medium mb-2">إجراءات سريعة</p>
          <button className="w-full text-sm text-foreground bg-secondary hover:bg-muted p-2.5 rounded-lg transition-colors text-center">
            🏷️ إضافة تصنيف
          </button>
          <button className="w-full text-sm text-foreground bg-secondary hover:bg-muted p-2.5 rounded-lg transition-colors text-center">
            📝 إضافة ملاحظة
          </button>
          <button className="w-full text-sm text-foreground bg-secondary hover:bg-muted p-2.5 rounded-lg transition-colors text-center">
            🚫 حظر العميل
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactPanel;
