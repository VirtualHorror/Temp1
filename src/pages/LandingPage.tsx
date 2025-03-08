import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileDigit, Lock, Clock, Activity, Award } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <Shield className="h-20 w-20 mx-auto text-white mb-8" />
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
          SmartWatch Evidence Extractor
        </h1>
        <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
          A powerful tool for cybercrime investigators to extract, analyze, and visualize
          evidence from smartwatches in a court-admissible format.
        </p>
        <Link
          to="/login"
          className="inline-block bg-white text-blue-900 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-blue-50 transition-colors"
        >
          Get Started
        </Link>
      </div>

      {/* Features Section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Key Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<FileDigit className="h-8 w-8 text-blue-600" />}
              title="Smart Data Extraction"
              description="Process Google Takeout files to extract comprehensive smartwatch data including activity, health metrics, and location information."
            />
            <FeatureCard
              icon={<Lock className="h-8 w-8 text-blue-600" />}
              title="Evidence Integrity"
              description="Cryptographic hashing ensures the authenticity and integrity of extracted evidence for court proceedings."
            />
            <FeatureCard
              icon={<Activity className="h-8 w-8 text-blue-600" />}
              title="Advanced Analytics"
              description="Visualize and analyze data with interactive charts, timelines, and filtering options for thorough investigation."
            />
          </div>
        </div>
      </div>

      {/* CideCode 2025 Section */}
      <div className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Award className="h-12 w-12 text-blue-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            CideCode 2025 Hackathon Project
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Developed for the CideCode 2025 cybersecurity hackathon in collaboration with
            the Crime Investigation Department (CID) of Karnataka and leading government
            agencies in information security and forensics.
          </p>
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-gray-50 p-6 rounded-lg">
    <div className="mb-4">{icon}</div>
    <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

export default LandingPage;