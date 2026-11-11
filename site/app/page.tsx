import HeroSection from '@/components/hero-section-2'
import AnchorsSection from '@/components/anchors-section'
import Features from '@/components/features-5'
import Principles from '@/components/principles'
import FAQs from '@/components/faqs-2'
import CallToAction from '@/components/call-to-action-3'
import Footer from '@/components/footer-4'

export default function Home() {
	return (
		<>
			<HeroSection />
			<main id="main">
				<AnchorsSection />
				<Features />
				<FAQs />
				<Principles />
				<CallToAction />
			</main>
			<Footer />
		</>
	)
}
