import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Card, Typography, DatePicker, Select, Input, Space, Tag, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import reportService from '../../services/reportService';
import financeCompanyService from '../../services/financeCompanyService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const formatCurrency = (value = 0) => `Rs. ${Number(value).toLocaleString()}`;
const formatDate = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';

const FinanceCompanySales = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    financeCompanyService.getAllFinanceCompanies().then(data => {
      setCompanies(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const fetchData = async (page = 1) => {
    if (!selectedCompany) {
      message.warning('Please select a finance company');
      return;
    }
    try {
      setLoading(true);
      const params = {
        financeCompany: selectedCompany,
        page,
        limit: 50,
      };
      if (dateRange?.[0]) params.fromDate = dateRange[0].toISOString();
      if (dateRange?.[1]) params.toDate = dateRange[1].toISOString();
      if (search) params.search = search;

      const data = await reportService.getFinanceCompanySales(params);
      setBills(data.bills || []);
      setPagination(data.pagination);
    } catch (err) {
      message.error(err.message || 'Failed to load report');
      setBills([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedCompany) {
      message.warning('Please select a finance company');
      return;
    }
    try {
      setPdfLoading(true);
      const params = { financeCompany: selectedCompany };
      if (dateRange?.[0]) params.fromDate = dateRange[0].toISOString();
      if (dateRange?.[1]) params.toDate = dateRange[1].toISOString();

      const blob = await reportService.getFinanceCompanySalesPdf(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finance-company-sales-${selectedCompany.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('PDF downloaded');
    } catch (err) {
      message.error(err.message || 'Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const filteredBills = useMemo(() => {
    if (!localSearch) return bills;
    const q = localSearch.toLowerCase();
    return bills.filter(b =>
      (b.billNumber || '').toLowerCase().includes(q) ||
      (b.customerName || '').toLowerCase().includes(q) ||
      (b.chassisNumber || '').toLowerCase().includes(q) ||
      (b.motorNumber || '').toLowerCase().includes(q) ||
      (b.bikeModel || '').toLowerCase().includes(q)
    );
  }, [bills, localSearch]);

  const totalAmount = filteredBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const withProforma = filteredBills.filter(b => b.proforma?.financeCompanyName).length;

  const columns = [
    { title: 'Bill No', dataIndex: 'billNumber', key: 'billNumber', width: 130, render: (v) => <Text strong>{v}</Text> },
    { title: 'Date', dataIndex: 'billDate', key: 'billDate', width: 100, render: (v) => formatDate(v) },
    { title: 'Customer', dataIndex: 'customerName', key: 'customerName', width: 180, ellipsis: true },
    { title: 'Chassis No', dataIndex: 'chassisNumber', key: 'chassisNumber', width: 140 },
    { title: 'Motor No', dataIndex: 'motorNumber', key: 'motorNumber', width: 150 },
    { title: 'Model', dataIndex: 'bikeModel', key: 'bikeModel', width: 120 },
    { title: 'Amount', dataIndex: 'totalAmount', key: 'totalAmount', width: 110, align: 'right', render: (v) => formatCurrency(v) },
    {
      title: 'Proforma',
      key: 'proforma',
      width: 90,
      render: (_, r) => r.proforma?.financeCompanyName ? (
        <Tag color="green">Issued</Tag>
      ) : (
        <Tag>Not Issued</Tag>
      ),
    },
    {
      title: 'Finance Co.',
      key: 'financeCompany',
      width: 160,
      ellipsis: true,
      render: (_, r) => r.proforma?.financeCompanyName || '—',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
          <Title level={4} className="!mb-0">Finance Company Sales Report</Title>
        </div>

        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <Text className="block mb-1 text-sm font-medium">Finance Company</Text>
            <Select
              showSearch
              placeholder="Select finance company..."
              style={{ width: 250 }}
              value={selectedCompany}
              onChange={setSelectedCompany}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={companies.map(c => ({ label: c.name, value: c.name }))}
              allowClear
            />
          </div>
          <div>
            <Text className="block mb-1 text-sm font-medium">Date Range</Text>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
            />
          </div>
          <div>
            <Text className="block mb-1 text-sm font-medium">Server Search</Text>
            <Input.Search
              placeholder="Bill / Customer / Chassis / Motor"
              style={{ width: 240 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={() => fetchData(1)}
              enterButton={<SearchOutlined />}
              allowClear
              onClear={() => { setSearch(''); fetchData(1); }}
            />
          </div>
          <Button type="primary" onClick={() => fetchData(1)} loading={loading}>
            Load Report
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadPdf} loading={pdfLoading}>
            Download PDF
          </Button>
        </div>

        {bills.length > 0 && (
          <div className="flex gap-6 mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
            <div><Text type="secondary">Total Sales</Text><div className="font-bold">{filteredBills.length}</div></div>
            <div><Text type="secondary">Total Amount</Text><div className="font-bold">{formatCurrency(totalAmount)}</div></div>
            <div><Text type="secondary">With Proforma</Text><div className="font-bold">{withProforma} of {filteredBills.length}</div></div>
          </div>
        )}

        <Table
          dataSource={filteredBills}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="small"
        />

        {pagination && pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: pagination.pages }, (_, i) => (
              <Button
                key={i + 1}
                size="small"
                type={pagination.page === i + 1 ? 'primary' : 'default'}
                onClick={() => fetchData(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
          </div>
        )}

        {bills.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
            <Text className="block mb-2 text-sm font-medium">
              <SearchOutlined className="mr-1" />Search within loaded results
            </Text>
            <Input.Search
              placeholder="Filter by bill number, customer, chassis, motor..."
              style={{ width: 350 }}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              allowClear
              onClear={() => setLocalSearch('')}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default FinanceCompanySales;
