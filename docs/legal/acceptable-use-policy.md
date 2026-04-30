# Acceptable Use Policy

**Document owner:** SettleGrid (Alerterra, LLC)
**Version:** 1.0
**Effective date:** 2026-04-18
**Review cadence:** Annually + on any material change to Stripe's or a counter-party MoR's AUP

---

## 1. Scope

This Acceptable Use Policy ("AUP") governs all use of SettleGrid's platform, APIs, SDKs, and services by Developers (merchants who sell tools through SettleGrid), Consumers (end buyers), and any integrator or user in between.

By using SettleGrid, you agree to this AUP. Your violation of this AUP is a material breach of the Developer Terms of Service or Consumer Terms of Service (as applicable) and permits SettleGrid to suspend or terminate your account, withhold payouts, reverse transactions, and take any further action this AUP authorizes.

This AUP is additive to — not in lieu of — the acceptable-use policies of SettleGrid's upstream providers, including Stripe's Restricted Businesses List at https://stripe.com/legal/restricted-businesses and any MoR provider SettleGrid integrates in the future. Where a provider's AUP prohibits conduct this AUP allows, the provider's AUP wins. SettleGrid cannot accept a payment the underlying rail refuses.

**Polar AUP note.** The P2.COMP1 spec asked this AUP to mirror both Stripe's and Polar's Restricted-Business lists. Polar was abandoned on 2026-04-14 after Polar declined SettleGrid's merchant application on marketplace/facilitation-AUP grounds (see `private/master-plan/multi-rail-architecture.md` — Pattern A+ pivot, and `docs/legal/polar-onboarding-status.md`). Polar's AUP is no longer a live constraint. The prohibitions below remain a superset of Polar's AUP as of the April 2026 snapshot; if SettleGrid ever activates a backup MoR (Paddle, Lemon Squeezy) the new MoR's Restricted-Business list is folded into this AUP via an amendment at that time (see §6).

---

## 2. Prohibited business categories

You may NOT use SettleGrid to conduct or facilitate any of the following:

### 2.1 Unlawful activity

- Any activity that violates applicable law in any jurisdiction where you or your customers are located.
- Any activity where US, UN, EU, or UK economic sanctions apply to you, your counterparty, or the underlying transaction. See `docs/legal/ofac-program.md` for SettleGrid's sanctions screening posture.
- Activities taking place in, or involving residents of, **Cuba, Iran, North Korea (DPRK), Syria, Crimea, the so-called Donetsk or Luhansk People's Republics** — these jurisdictions are **blocked at onboarding** and any attempt to circumvent that block through falsified residency is a terminable offense.
- Activities by or for any person on the US Treasury OFAC SDN list, the UK HMT Consolidated List, or EU sanctions lists.
- Any activity subject to the Bank Secrecy Act's money-service-business registration that SettleGrid has not expressly authorized. SettleGrid operates under the 31 CFR 1010.100(ff)(5)(ii)(B) payment-processor exemption; activities that push a developer's use of SettleGrid outside those four conditions require prior written approval or are prohibited.

### 2.2 High-risk industries

Independent of legality, SettleGrid does not support the following categories at Phase-2 launch. This list may expand as SettleGrid's risk posture matures.

- **Gambling, lotteries, sweepstakes, sports betting, fantasy sports, skill-gaming with wagered entry fees**
- **Adult content, including pornography, adult live-streaming, escort services, sugar-daddy/sugar-baby matching**
- **Firearms, ammunition, knives over 3", and any weapon subject to US ATF regulation**
- **Controlled substances, including cannabis (even where state-legal), CBD derived from cannabis (as distinct from hemp CBD) in non-compliant states, kratom, kava, and any research-chemical or psychoactive substance**
- **Prescription drugs and controlled medical devices, including Rx pharmacy fulfillment, compounding pharmacy services, telehealth that prescribes scheduled substances**
- **Tobacco, e-cigarettes, vapes, and nicotine-containing products**
- **Financial services without appropriate licensing**, including money transmission, foreign currency exchange, cryptocurrency exchange, custodial wallet services, debt collection, credit repair, stock tips, binary options, initial coin offerings
- **Multi-level marketing (MLM), pyramid schemes, matrix schemes, business-opportunity schemes that require recruitment**
- **Get-rich-quick programs, work-from-home schemes, seminar-based "mentorship" with unverified outcomes**
- **Travel-related services that require seller-of-travel registration** the developer does not hold (California, Florida, Iowa, Washington)
- **Ticket reselling, scalping, and any secondary-market ticket brokerage**
- **Counterfeit goods, products infringing trademark or copyright**
- **Essays, term papers, or any academic work intended for submission by a third party**
- **Dating services charging per-message or per-match fees above de-minimis**
- **Psychic services, astrology, tarot, fortune-telling, mediumship, channeled readings**
- **"Miracle cure" medical claims, unproven disease-treatment claims, vaccine misinformation**
- **Deceptive marketing** — false testimonials, fake scarcity, fabricated expert endorsements, astroturfed reviews
- **Aggressive debt collection** practices prohibited by the FDCPA or state equivalents
- **Bail bonds, bounty-hunter services**
- **Human trafficking, exploitation, or any activity that facilitates either**
- **CSAM and any conduct that violates 18 USC §§ 2251–2260 or equivalent non-US statutes** — zero tolerance, immediate termination, immediate reporting to law enforcement under 18 USC § 2258A

### 2.3 Harmful AI applications

As an AI-tool platform, SettleGrid pays specific attention to harmful AI use cases. You may NOT sell, distribute, or facilitate:

- **Non-consensual intimate imagery generation**, including deepfake pornography, face-swap pornography, undressing/nudifying models of any specific individual
- **Voice or face impersonation of real identifiable individuals** without a documented rights agreement with that individual
- **Tools primarily designed to generate CSAM**, including diffusion-model fine-tunes targeting minors regardless of the developer's stated intent
- **Bioweapon or chemical-weapon synthesis assistance**, tools that help design, manufacture, or acquire CBRN materials
- **Cyber-offense tools** that target infrastructure the operator does not own or have explicit written authorization to test. Legitimate security-research tools are allowed when distributed within a defined authorized-testing population (e.g., bug-bounty platforms).
- **Tools for scaled academic dishonesty**, including "undetectable AI" writing tools marketed explicitly for evading plagiarism detection in academic submission
- **Election manipulation tools**, including targeted voter-suppression robocalling systems, deepfake campaign-ad generation without clear synthetic disclosure
- **Tools for harassment at scale**, including automated doxxing, targeted swatting-assistance, or any automation designed to coerce a specific individual

If you are uncertain whether your AI use case falls in a gray zone, email aup@settlegrid.ai (routes to founder inbox) BEFORE launching on SettleGrid. Good-faith pre-clearance is materially protective; launching, getting flagged, and claiming surprise is not.

---

## 3. Content restrictions

### 3.1 Tool metadata

Tool listings (name, description, category, documentation) may not:

- Contain false claims about the tool's capabilities, provider, pricing, or uptime
- Impersonate another developer, company, or product
- Include hate speech, slurs, or harassing language
- Include political-candidate endorsements for candidates in an active election cycle
- Include medical, legal, or financial advice phrased as personalized recommendation rather than general information

### 3.2 Customer-facing content from a tool invocation

When a SettleGrid tool is invoked and returns content to a consumer:

- You are responsible for the content your tool returns
- Content that would be prohibited under §2 or §3.1 is equally prohibited as a tool output, regardless of the prompt that produced it
- SettleGrid reserves the right to require content-filtering SDK integration for any tool whose output is found to be repeatedly in violation

---

## 4. Technical abuse + operational conduct

You may NOT use SettleGrid to:

- Circumvent rate limits, billing meters, or any security control
- Reverse-engineer SettleGrid's pricing to extract proprietary pricing signals for competitive purposes
- Scrape SettleGrid's public surfaces (directory, marketplace) at a rate materially above the robots.txt policy
- Resell SettleGrid's own services under a different brand without prior written agreement
- Test SettleGrid's production APIs with synthetic load above the rate specified for your plan (use the sandbox environment for load testing)
- Deploy a SettleGrid API key on a system you don't control, or leak a key through committed source code, public pastebin, etc.
- Submit false chargebacks, including disputing a charge with a rail while simultaneously holding the delivered service
- Use a SettleGrid account to launder fraudulent charges — e.g., registering as a developer to wash stolen-card consumer charges through the payout side

---

## 5. Enforcement process

### 5.1 Detection

SettleGrid detects violations through:

- Automated controls: rate limits, duplicate-transaction detection, SDN screening, chargeback velocity alerts, suspicious-activity heuristics
- Stripe's own risk signals, surfaced via Stripe's risk API
- User reports via report@settlegrid.ai
- Periodic manual review of top-volume accounts

### 5.2 Graduated response

Not every violation triggers termination. SettleGrid uses a graduated response proportional to severity + intent:

1. **Notice.** For a first instance of a minor or ambiguous violation, SettleGrid issues written notice with the specific allegation + a 7-day remediation window.
2. **Hold.** For any violation that creates immediate risk to consumers, rail partners, or SettleGrid's regulatory posture, SettleGrid places the account on hold: outbound payouts paused, no new subscriptions accepted. Holds are resolved in one of three ways: remediation + reinstatement; migration to a different rail; termination.
3. **Termination.** SettleGrid terminates an account and (where legally permitted) forfeits or refunds pending balances when: (a) a §2.1 unlawful-activity violation is confirmed; (b) a §2.3 harmful-AI-applications violation is confirmed; (c) a repeat or escalating violation under a prior Notice; (d) the rail provider (Stripe, future MoR) requires it; (e) OFAC or another authority issues a directive. Termination under (a), (b), or (e) is effective immediately; under (c) or (d), SettleGrid gives 48 hours' notice where operationally possible.

### 5.3 Appeals

A terminated developer may appeal within 30 days by emailing aup-appeal@settlegrid.ai with:

- The termination notice SettleGrid sent
- The factual basis for the appeal (why the violation determination is incorrect, or what remediation occurred)
- Any documentary evidence

Appeals are reviewed by the compliance officer within 10 business days. Appeals alleging SDN-list false positives are prioritized to 72 hours. Appeals do NOT stay enforcement — the account remains terminated during review; if the appeal succeeds, funds are released and the account reinstated.

### 5.4 Coordination with law enforcement

SettleGrid reports to law enforcement when legally required (e.g., CSAM reporting under 18 USC § 2258A) and may voluntarily report when it judges reporting is necessary to prevent imminent harm. Voluntary reports are made through counsel, not directly.

---

## 6. Amendments

SettleGrid may amend this AUP by publishing an updated version at `https://settlegrid.ai/legal/acceptable-use-policy` and providing 14 days' email notice to active developers. Material changes that SHRINK the prohibited list take effect immediately (benefit to developers); changes that EXPAND it take effect at the end of the 14-day notice period.

A developer who does not accept an amended AUP may terminate their account before the effective date and receive an unrestricted payout of funds held.

---

## 7. Contact

- **General AUP questions, pre-clearance:** aup@settlegrid.ai
- **Violation reports:** report@settlegrid.ai
- **Termination appeals:** aup-appeal@settlegrid.ai
- **Compliance officer (same-day for OFAC or CSAM concerns):** compliance@settlegrid.ai

All addresses route to the founder inbox. SettleGrid commits to a first response within 2 business days for routine questions and 24 hours for violation reports or appeals.

---

## Change log

| Date | Version | Change |
|---|---|---|
| 2026-04-18 | 1.0 | Initial AUP drafted under P2.COMP1. Mirrors Stripe's Restricted Businesses List + expands on AI-specific harms. Lawyer review scheduled for Phase-2 engagement window. |
