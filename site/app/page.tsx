import HeroSection from '@/components/hero-section-2'
import Principles from '@/components/principles'
import FAQs from '@/components/faqs-2'
import CallToAction from '@/components/call-to-action-3'
import Footer from '@/components/footer-4'

export default function Home() {
	return (
		<>
			<HeroSection />
			<main id="main">
				<Principles />
				<FAQs />
				<CallToAction />
			</main>
			<Footer />
		</>
	)
}
