import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface DesignEstimateEmailProps {
  clientName: string;
  companyName: string;
  imageUrl: string;
  estimate: {
    items: Array<{
      feature: string;
      description: string;
      quantity: string;
      unitCost: string;
      totalCost: number;
      notes?: string;
    }>;
    subtotal: number;
    laborCost: number;
    total: number;
    disclaimer?: string;
  };
  features: string[];
}

export const DesignEstimateEmail = ({
  clientName,
  companyName,
  imageUrl,
  estimate,
  features,
}: DesignEstimateEmailProps) => (
  <Html>
    <Head />
    <Preview>Your Custom Backyard Design & Estimate from {companyName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>Your Custom Backyard Design</Heading>
        </Section>
        
        <Section style={contentSection}>
          <Text style={greeting}>
            Hi {clientName},
          </Text>
          
          <Text style={text}>
            Thank you for your interest! We've created a custom backyard design concept for you. 
            Below you'll find your personalized visualization along with a detailed cost estimate.
          </Text>
        </Section>

        <Section style={imageSection}>
          <Img
            src={imageUrl}
            alt="Your custom backyard design"
            style={image}
          />
        </Section>

        <Section style={contentSection}>
          <Section style={featuresBox}>
            <Heading style={h2}>Design Features</Heading>
            <div style={featuresList}>
              {features.map((feature, idx) => (
                <Text key={idx} style={featureItem}>
                  ✓ {feature}
                </Text>
              ))}
            </div>
          </Section>
        </Section>

        <Section style={contentSection}>
          <Heading style={h2}>Investment Breakdown</Heading>
          
          <Section style={estimateBox}>
            {estimate.items.map((item, index) => (
              <Section key={index} style={itemSection}>
                <div style={itemHeader}>
                  <Text style={itemTitle}>{item.feature}</Text>
                  <Text style={itemPrice}>${item.totalCost.toLocaleString()}</Text>
                </div>
                <Text style={itemDescription}>{item.description}</Text>
                <Text style={itemDetails}>
                  {item.quantity} × {item.unitCost}
                </Text>
                {item.notes && (
                  <Text style={itemNotes}>Note: {item.notes}</Text>
                )}
              </Section>
            ))}
          </Section>

          <Section style={summaryBox}>
            <div style={summaryRow}>
              <Text style={summaryLabel}>Materials Subtotal</Text>
              <Text style={summaryValue}>${estimate.subtotal.toLocaleString()}</Text>
            </div>
            <div style={summaryRow}>
              <Text style={summaryLabel}>Labor & Installation</Text>
              <Text style={summaryValue}>${estimate.laborCost.toLocaleString()}</Text>
            </div>
            <Hr style={totalDivider} />
            <div style={totalRow}>
              <Text style={totalLabel}>Total Investment</Text>
              <Text style={totalValue}>${estimate.total.toLocaleString()}</Text>
            </div>
          </Section>

          {estimate.disclaimer && (
            <Section style={disclaimerBox}>
              <Text style={disclaimer}>
                {estimate.disclaimer}
              </Text>
            </Section>
          )}
        </Section>

        <Section style={ctaSection}>
          <Text style={ctaText}>
            We're excited to help bring your backyard vision to life! This estimate is based on 
            the design shown above and standard installation practices.
          </Text>

          <Text style={ctaText}>
            Ready to get started or have questions? We're here to help you create the perfect outdoor space.
          </Text>
        </Section>

        <Section style={footerSection}>
          <Text style={footer}>
            Best regards,<br />
            <strong>{companyName}</strong>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default DesignEstimateEmail;

const main = {
  backgroundColor: '#f4f7fa',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  padding: '40px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '600px',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07)',
};

const headerSection = {
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  padding: '40px 32px',
  textAlign: 'center' as const,
};

const h1 = {
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '0',
  padding: '0',
  textAlign: 'center' as const,
};

const contentSection = {
  padding: '0 32px',
  margin: '24px 0',
};

const greeting = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 16px 0',
};

const text = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
};

const imageSection = {
  padding: '0',
  margin: '32px 0',
};

const image = {
  width: '100%',
  maxWidth: '600px',
  display: 'block',
};

const featuresBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  border: '1px solid #e5e7eb',
};

const h2 = {
  color: '#111827',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0 0 16px 0',
};

const featuresList = {
  margin: '0',
  padding: '0',
};

const featureItem = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '28px',
  margin: '0',
  padding: '0',
};

const estimateBox = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const itemSection = {
  padding: '16px',
  margin: '0 0 12px 0',
  borderBottom: '1px solid #f3f4f6',
};

const itemHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '8px',
};

const itemTitle = {
  color: '#111827',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
};

const itemPrice = {
  color: '#059669',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
  textAlign: 'right' as const,
};

const itemDescription = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '4px 0',
  lineHeight: '20px',
};

const itemDetails = {
  color: '#9ca3af',
  fontSize: '13px',
  margin: '4px 0',
};

const itemNotes = {
  color: '#9ca3af',
  fontSize: '12px',
  fontStyle: 'italic',
  margin: '8px 0 0 0',
  padding: '8px 12px',
  backgroundColor: '#fef3c7',
  borderRadius: '4px',
  borderLeft: '3px solid #f59e0b',
};

const summaryBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const summaryRow = {
  display: 'flex',
  justifyContent: 'space-between',
  margin: '12px 0',
};

const summaryLabel = {
  color: '#6b7280',
  fontSize: '15px',
  margin: '0',
};

const summaryValue = {
  color: '#111827',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0',
};

const totalDivider = {
  borderColor: '#d1d5db',
  margin: '16px 0',
  borderWidth: '2px',
};

const totalRow = {
  display: 'flex',
  justifyContent: 'space-between',
  margin: '16px 0 0 0',
};

const totalLabel = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
};

const totalValue = {
  color: '#059669',
  fontSize: '24px',
  fontWeight: '800',
  margin: '0',
};

const disclaimerBox = {
  backgroundColor: '#fef9f3',
  borderRadius: '8px',
  padding: '16px',
  border: '1px solid #fed7aa',
  margin: '24px 0',
};

const disclaimer = {
  color: '#92400e',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
  fontStyle: 'italic',
};

const ctaSection = {
  padding: '32px',
  backgroundColor: '#f9fafb',
  textAlign: 'center' as const,
  margin: '32px 0 0 0',
};

const ctaText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 12px 0',
  textAlign: 'center' as const,
};

const footerSection = {
  padding: '32px',
  textAlign: 'center' as const,
  borderTop: '1px solid #e5e7eb',
};

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
  textAlign: 'center' as const,
};
