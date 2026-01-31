import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Display, Heading1, Heading2, Body, Caption, Small } from '@/components/common/Typography';

export default function DesignSystemDemo() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <Display className="text-hot-pink mb-2">Dark Mode & Hot Pink Design System</Display>
          <Body className="text-secondary-text">Live Commerce Platform - Design System Demo</Body>
        </div>

        {/* Color Palette */}
        <Card>
          <Heading1 className="mb-4">Color Palette</Heading1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="w-full h-20 bg-white rounded-button border border-primary-text/20 mb-2"></div>
              <Caption>Primary Black</Caption>
              <Small>#121212</Small>
            </div>
            <div>
              <div className="w-full h-20 bg-content-bg rounded-button mb-2"></div>
              <Caption>Content BG</Caption>
              <Small>#1E1E1E</Small>
            </div>
            <div>
              <div className="w-full h-20 bg-hot-pink rounded-button mb-2"></div>
              <Caption>Hot Pink</Caption>
              <Small>#FF007A</Small>
            </div>
            <div>
              <div className="w-full h-20 bg-success rounded-button mb-2"></div>
              <Caption>Success</Caption>
              <Small>#34C759</Small>
            </div>
          </div>
        </Card>

        {/* Typography */}
        <Card>
          <Heading1 className="mb-4">Typography</Heading1>
          <div className="space-y-4">
            <div>
              <Display>Display Text - 28px Bold</Display>
              <Small className="block mt-1">Font: Pretendard</Small>
            </div>
            <div>
              <Heading1>Heading 1 - 22px Bold</Heading1>
            </div>
            <div>
              <Heading2>Heading 2 - 18px SemiBold</Heading2>
            </div>
            <div>
              <Body>Body Text - 16px Regular. This is the main text used throughout the application for readable content.</Body>
            </div>
            <div>
              <Caption>Caption - 14px Medium. Used for labels and secondary information.</Caption>
            </div>
            <div>
              <Small>Small - 12px Regular. Used for metadata and fine print.</Small>
            </div>
          </div>
        </Card>

        {/* Buttons */}
        <Card>
          <Heading1 className="mb-4">Buttons</Heading1>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button variant="primary" size="sm">Small Primary</Button>
              <Button variant="primary" size="md">Medium Primary</Button>
              <Button variant="primary" size="lg">Large Primary</Button>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="primary" fullWidth>Full Width Button</Button>
            </div>
          </div>
        </Card>

        {/* Cards */}
        <div>
          <Heading1 className="mb-4">Cards</Heading1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <Heading2 className="mb-2">Basic Card</Heading2>
              <Body>This is a basic card with default padding and styling.</Body>
            </Card>
            <Card hover>
              <Heading2 className="mb-2">Hoverable Card</Heading2>
              <Body>This card has hover effects. Try hovering over it!</Body>
            </Card>
          </div>
        </div>

        {/* Border Radius */}
        <Card>
          <Heading1 className="mb-4">Border Radius</Heading1>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="w-full h-20 bg-hot-pink rounded-card mb-2"></div>
              <Caption>Card - 12px</Caption>
            </div>
            <div>
              <div className="w-full h-20 bg-hot-pink rounded-button mb-2"></div>
              <Caption>Button - 8px</Caption>
            </div>
            <div>
              <div className="w-full h-20 bg-hot-pink rounded-small mb-2"></div>
              <Caption>Small - 4px</Caption>
            </div>
          </div>
        </Card>

        {/* Responsive Breakpoints */}
        <Card>
          <Heading1 className="mb-4">Responsive Breakpoints</Heading1>
          <div className="space-y-2">
            <div className="block xs:hidden"><Body className="text-hot-pink">XS (320px+): Visible</Body></div>
            <div className="hidden xs:block sm:hidden"><Body className="text-hot-pink">SM (640px+): Visible</Body></div>
            <div className="hidden sm:block md:hidden"><Body className="text-hot-pink">MD (768px+): Visible</Body></div>
            <div className="hidden md:block lg:hidden"><Body className="text-hot-pink">LG (1024px+): Visible</Body></div>
            <div className="hidden lg:block"><Body className="text-hot-pink">XL (1280px+): Visible</Body></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
