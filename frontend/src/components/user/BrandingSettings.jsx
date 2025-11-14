import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Button, Space, Typography, message } from 'antd';
import apiClient from '../../config/apiClient';

const { Title, Text } = Typography;

const LogoPreview = ({ url }) => {
  const [error, setError] = useState(false);
  const src = useMemo(() => (typeof url === 'string' ? url.trim() : ''), [url]);

  if (!src || error) {
    return (
      <div className="flex items-center justify-center h-24 w-24 rounded bg-gray-100 dark:bg-slate-800 text-gray-400">
        <span className="text-xs">No Logo</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Logo preview"
      className="h-24 w-24 object-contain rounded border border-gray-200 dark:border-slate-700"
      onError={() => setError(true)}
    />
  );
};

export default function BrandingSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const branding = await apiClient.get('/api/branding');
        form.setFieldsValue({
          dealerName: branding?.dealerName ?? '',
          logoUrl: branding?.logoUrl ?? '',
          primaryColor: branding?.primaryColor ?? '',
          addressLine1: branding?.addressLine1 ?? '',
          addressLine2: branding?.addressLine2 ?? '',
          brandPartner: branding?.brandPartner ?? '',
          footerNote: branding?.footerNote ?? '',
        });
      } catch (err) {
        message.warning('Unable to load branding; default values will be used.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [form]);

  const onSave = async (values) => {
    try {
      setSaving(true);
      const updated = await apiClient.put('/api/branding', values);
      form.setFieldsValue(updated);
      message.success('Branding updated');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update branding';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const generatePreview = async () => {
    try {
      const branding = await apiClient.get('/api/branding');
      const thankYou = 'Thank you for your business!';
      const footerCombined = branding?.footerNote
        ? `${thankYou}\n${branding.footerNote}`
        : thankYou;

      const payload = {
        id: 'PREVIEW',
        billType: 'cash',
        billDate: new Date().toISOString(),
        customerName: 'Preview Customer',
        customerNIC: 'N/A',
        customerAddress: branding?.addressLine1 || '',
        bikeModel: 'Preview Model',
        bikePrice: 0,
        totalAmount: 0,
        rmvCharge: 0,
        branding: {
          dealerName: branding?.dealerName,
          logoUrl: branding?.logoUrl,
          footerNote: footerCombined,
          brandPartner: branding?.brandPartner,
          addressLine1: branding?.addressLine1,
          addressLine2: branding?.addressLine2,
          primaryColor: branding?.primaryColor,
        },
      };

      const blob = await apiClient.get(`/api/bills/preview/pdf?formData=${encodeURIComponent(JSON.stringify(payload))}`);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      message.success('Preview generated');
    } catch (err) {
      message.error('Failed to generate preview');
    }
  };

  const values = form.getFieldsValue();

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <Title level={4} className="!mb-2">Branding</Title>
            <Text type="secondary">Update visible branding values used across the app and PDFs.</Text>
            <Form
              form={form}
              layout="vertical"
              className="mt-4"
              onFinish={onSave}
              initialValues={{}}
              disabled={loading}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item label="Dealer Name" name="dealerName" rules={[{ required: true, message: 'Dealer name is required' }]}>
                  <Input placeholder="e.g., TMR Trading Lanka (Pvt) Ltd" />
                </Form.Item>

                <Form.Item label="Brand Partner" name="brandPartner">
                  <Input placeholder="e.g., TMR Trading Lanka (Pvt) Ltd" />
                </Form.Item>

                <Form.Item label="Primary Color" name="primaryColor">
                  <Input placeholder="#1e90ff" />
                </Form.Item>

                <Form.Item label="Logo URL" name="logoUrl">
                  <Input placeholder="https://.../logo.png" />
                </Form.Item>

                <Form.Item label="Address Line 1" name="addressLine1">
                  <Input placeholder="Street, City" />
                </Form.Item>

                <Form.Item label="Address Line 2" name="addressLine2">
                  <Input placeholder="Province, Country" />
                </Form.Item>

                <Form.Item label="Footer Note" name="footerNote">
                  <Input placeholder="Optional footer text on PDFs" />
                </Form.Item>
              </div>

              <Space className="mt-2">
                <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
                <Button onClick={generatePreview}>Preview Bill</Button>
              </Space>
            </Form>
          </div>

          <div className="w-48">
            <Text strong>Logo Preview</Text>
            <div className="mt-2">
              <LogoPreview url={values?.logoUrl} />
            </div>
          </div>
        </div>
      </Card>

      {previewUrl && (
        <Card title="Bill Preview" className="shadow-sm">
          <iframe
            src={previewUrl}
            title="Bill Preview"
            className="w-full h-[600px] border border-gray-200 dark:border-slate-700 rounded"
          />
        </Card>
      )}
    </div>
  );
}
