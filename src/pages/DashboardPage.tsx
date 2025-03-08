import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { Activity, Heart, Footprints as FootPrints, Clock, Calendar } from 'lucide-react';

const timeRanges = [
  { label: '1 Day', value: '1d' },
  { label: '7 Days', value: '7d' },
  { label: '15 Days', value: '15d' },
  { label: '1 Month', value: '1m' },
  { label: '3 Months', value: '3m' },
  { label: '6 Months', value: '6m' },
  { label: '1 Year', value: '1y' }
];

const DashboardPage = () => {
  const [timeRange, setTimeRange] = useState('1d');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fileHash = localStorage.getItem('currentFileHash');
        if (!fileHash) {
          throw new Error('No file hash found');
        }

        const response = await fetch(`http://localhost:3000/api/data/${fileHash}`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch data');
        }

        setData(result.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
        <div className="text-red-600 text-center">
          <p className="text-xl font-semibold mb-2">Error loading data</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Filter data based on selected time range
  const filterDataByTimeRange = (data: any[], range: string) => {
    const now = new Date();
    let cutoff = new Date();

    switch (range) {
      case '1d':
        cutoff.setDate(now.getDate() - 1);
        break;
      case '7d':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '15d':
        cutoff.setDate(now.getDate() - 15);
        break;
      case '1m':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case '3m':
        cutoff.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        cutoff.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return data;
    }

    return data.filter((item: any) => new Date(item.time) >= cutoff);
  };

  const filteredHeartRate = filterDataByTimeRange(data?.heartRate || [], timeRange);
  const filteredSteps = filterDataByTimeRange(data?.steps || [], timeRange);

  // Calculate averages for stat cards
  const calculateAverage = (data: any[]) => {
    if (!data.length) return 0;
    return Math.round(data.reduce((acc, curr) => acc + curr.value, 0) / data.length);
  };

  const averageHeartRate = calculateAverage(filteredHeartRate);
  const totalSteps = filteredSteps.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Evidence Dashboard</h1>
          <p className="mt-1 text-gray-600">
            Analyze and visualize extracted smartwatch data
          </p>
        </div>

        {/* Controls */}
        <div className="mb-8 flex flex-wrap gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {timeRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>

          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="all">All Devices</option>
            {data?.devices?.map((device: string) => (
              <option key={device} value={device}>{device}</option>
            ))}
          </select>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Heart className="h-6 w-6 text-red-600" />}
            title="Average Heart Rate"
            value={`${averageHeartRate} BPM`}
          />
          <StatCard
            icon={<FootPrints className="h-6 w-6 text-blue-600" />}
            title="Total Steps"
            value={totalSteps.toLocaleString()}
          />
          <StatCard
            icon={<Activity className="h-6 w-6 text-green-600" />}
            title="Active Minutes"
            value={`${data?.activeMinutes?.length || 0} mins`}
          />
          <StatCard
            icon={<Clock className="h-6 w-6 text-purple-600" />}
            title="Sleep Duration"
            value={`${data?.sleep?.length || 0}h`}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Heart Rate Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Heart Rate Over Time</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredHeartRate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(time) => new Date(time).toLocaleString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#ef4444"
                    name="Heart Rate (BPM)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Steps Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Step Count</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredSteps}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={(time) => new Date(time).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(time) => new Date(time).toLocaleString()}
                  />
                  <Legend />
                  <Bar dataKey="value" fill="#3b82f6" name="Steps" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* File Hash Information */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evidence Integrity</h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Original File Hash (SHA-256):</strong>
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded">
                {data?.fileHash || 'No hash available'}
              </code>
            </p>
            <p className="text-sm text-gray-600">
              <strong>Last Verified:</strong> {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) => (
  <div className="bg-white p-6 rounded-lg shadow">
    <div className="flex items-center">
      <div className="flex-shrink-0">{icon}</div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

export default DashboardPage;