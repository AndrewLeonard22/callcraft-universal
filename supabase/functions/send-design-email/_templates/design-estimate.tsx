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
        <Heading style={h1}>Your Custom Backyard Design</Heading>
        
        <Text style={text}>
          Hi {clientName},
        </Text>
        
        <Text style={text}>
          Thank you for your interest! We've created a custom backyard design concept for you. 
          Below you'll find your personalized visualization along with a detailed cost estimate.
        </Text>

        <Section style={imageSection}>
          <Img
            src={imageUrl}
            alt="Your custom backyard design"
            style={image}
          />
        </Section>

        <Section style={featuresSection}>
          <Heading style={h2}>Design Features</Heading>
          <Text style={text}>
            Your design includes: {features.join(', ')}
          </Text>
        </Section>

        <Hr style={hr} />

        <Section style={estimateSection}>
          <Heading style={h2}>Cost Estimate</Heading>
          
          {estimate.items.map((item, index) => (
            <Section key={index} style={itemSection}>
              <Text style={itemTitle}>{item.feature}</Text>
              <Text style={itemDescription}>{item.description}</Text>
              <Text style={itemDetails}>
                {item.quantity} × {item.unitCost}
              </Text>
              {item.notes && (
                <Text style={itemNotes}>{item.notes}</Text>
              )}
              <Text style={itemPrice}>${item.totalCost.toLocaleString()}</Text>
            </Section>
          ))}

          <Hr style={hr} />

          <Section style={summarySection}>
            <Text style={summaryLine}>
              <span style={summaryLabel}>Materials Subtotal:</span>
              <span style={summaryValue}>${estimate.subtotal.toLocaleString()}</span>
            </Text>
            <Text style={summaryLine}>
              <span style={summaryLabel}>Labor & Installation:</span>
              <span style={summaryValue}>${estimate.laborCost.toLocaleString()}</span>
            </Text>
            <Text style={totalLine}>
              <span style={totalLabel}>Total Estimate:</span>
              <span style={totalValue}>${estimate.total.toLocaleString()}</span>
            </Text>
          </Section>

          {estimate.disclaimer && (
            <Text style={disclaimer}>
              * {estimate.disclaimer}
            </Text>
          )}
        </Section>

        <Hr style={hr} />

        <Text style={text}>
          We're excited to help bring your backyard vision to life! This estimate is based on 
          the design shown above and standard installation practices.
        </Text>

        <Text style={text}>
          Please don't hesitate to reach out if you have any questions or would like to 
          discuss customizations to the design.
        </Text>

        <Text style={footer}>
          Best regards,<br />
          {companyName}
        </Text>
      </Container>
    </Body>
  </Html>
);

export default DesignEstimateEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const h2 = {
  color: '#333',
  fontSize: '22px',
  fontWeight: 'bold',
  margin: '30px 0 20px',
  padding: '0',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 20px',
};

const imageSection = {
  margin: '32px 20px',
};

const image = {
  width: '100%',
  maxWidth: '600px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
};

const featuresSection = {
  margin: '32px 20px',
};

const estimateSection = {
  margin: '32px 20px',
};

const itemSection = {
  margin: '16px 0',
  padding: '16px',
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
};

const itemTitle = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 8px 0',
};

const itemDescription = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '4px 0',
};

const itemDetails = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '4px 0',
};

const itemNotes = {
  color: '#9ca3af',
  fontSize: '13px',
  fontStyle: 'italic',
  margin: '8px 0 0 0',
};

const itemPrice = {
  color: '#111827',
  fontSize: '18px',
  fontWeight: '600',
  margin: '8px 0 0 0',
  textAlign: 'right' as const,
};

const summarySection = {
  margin: '24px 0',
};

const summaryLine = {
  fontSize: '16px',
  margin: '8px 0',
  display: 'flex',
  justifyContent: 'space-between',
};

const summaryLabel = {
  color: '#6b7280',
};

const summaryValue = {
  color: '#111827',
  fontWeight: '500',
};

const totalLine = {
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '16px 0 0 0',
  padding: '16px 0 0 0',
  borderTop: '2px solid #e5e7eb',
  display: 'flex',
  justifyContent: 'space-between',
};

const totalLabel = {
  color: '#111827',
};

const totalValue = {
  color: '#2563eb',
};

const disclaimer = {
  color: '#9ca3af',
  fontSize: '13px',
  fontStyle: 'italic',
  margin: '24px 0',
  padding: '16px',
  backgroundColor: '#f9fafb',
  borderLeft: '4px solid #e5e7eb',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '32px 0',
};

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '32px 20px',
};
