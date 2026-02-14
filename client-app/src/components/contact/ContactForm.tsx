'use client';

import { useState } from 'react';
import { Heading2, Body } from '@/components/common/Typography';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { MessageCircle, CheckCircle } from 'lucide-react';

interface ContactFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactForm({ isOpen, onClose }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSuccess(true);
    setIsSubmitting(false);

    // Reset after 2 seconds
    setTimeout(() => {
      setIsSuccess(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
      onClose();
    }, 2000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (isSuccess) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="문의 완료" maxWidth="md">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <Heading2 className="text-primary-text mb-2">문의가 접수되었습니다</Heading2>
          <Body className="text-secondary-text">
            빠른 시일 내에 답변 드리겠습니다.
          </Body>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="문의하기" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="이름"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="홍길동"
            required
            fullWidth
          />
          <Input
            label="이메일"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="example@email.com"
            required
            fullWidth
          />
        </div>

        <Input
          label="제목"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          placeholder="문의 제목을 입력하세요"
          required
          fullWidth
        />

        <div>
          <label className="block text-sm font-medium text-secondary-text mb-2">
            문의 내용 <span className="text-error">*</span>
          </label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="문의하실 내용을 상세히 입력해주세요"
            rows={6}
            required
            className="w-full bg-content-bg border border-border-color rounded-lg px-4 py-3 text-primary-text placeholder:text-secondary-text focus:outline-none focus:border-hot-pink transition-colors resize-none"
          />
        </div>

        <div className="flex gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={onClose}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
            {isSubmitting ? '전송 중...' : '문의하기'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
