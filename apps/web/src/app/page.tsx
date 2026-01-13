import Link from 'next/link';
import { ArrowRight, Database, Zap, Users, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <span className="text-xl font-bold text-primary-600">TestBox Clone</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="btn btn-primary btn-sm"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
              Generate Realistic Demo Data
              <span className="block text-primary-600">for Salesforce & People.ai</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              Create AI-powered synthetic sales data including emails, call transcripts, and CRM records.
              Inject directly into Salesforce and showcase People.ai insights with realistic demo environments.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="/register"
                className="btn btn-primary btn-lg"
              >
                Start Generating Data
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="btn btn-outline btn-lg"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">
              Everything you need for compelling demos
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Generate, inject, and manage synthetic CRM data with ease
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Zap className="h-8 w-8 text-primary-600" />}
              title="AI-Powered Generation"
              description="Use GPT-4 to create realistic emails, call transcripts, and meeting notes that feel authentic."
            />
            <FeatureCard
              icon={<Database className="h-8 w-8 text-primary-600" />}
              title="Direct Salesforce Integration"
              description="Inject data directly into Salesforce via API. Works with production orgs and sandboxes."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-primary-600" />}
              title="Multi-User Support"
              description="Each team member can generate their own isolated demo datasets without conflicts."
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8 text-primary-600" />}
              title="PII-Free Data"
              description="All generated data is fictional and safe for demos. No real customer information."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to create your first demo dataset?
          </h2>
          <p className="mt-4 text-lg text-primary-100">
            Get started in minutes. No credit card required.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center btn btn-lg bg-white text-primary-600 hover:bg-gray-100"
          >
            Create Free Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              TestBox Clone - Demo Data Generator for Salesforce & People.ai
            </span>
            <div className="flex gap-6">
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900">
                Documentation
              </a>
              <a href="#" className="text-sm text-gray-500 hover:text-gray-900">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card p-6">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}
