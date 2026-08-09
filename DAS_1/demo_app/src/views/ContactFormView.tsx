import React, { useState } from 'react'
import './ContactFormView.css'

interface ContactFormProps {
  disabled?: boolean
  onSubmit: (details: { name: string; email: string; phone: string }) => void
}

export function ContactFormView({ disabled = false, onSubmit }: ContactFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email) return
    onSubmit({ name, email, phone })
  }

  return (
    <div className="contact-form-container">
      <div className="contact-card">
        <h2 className="contact-title">Personal details</h2>

        <form onSubmit={handleSubmit}>
          <div className="contact-grid">
            <div className="field-group">
              <label htmlFor="contact-name">Name *</label>
              <input
                id="contact-name"
                type="text"
                className="contact-input"
                placeholder="John Doe"
                required
                value={name}
                disabled={disabled}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="contact-email">Email *</label>
              <input
                id="contact-email"
                type="email"
                className="contact-input"
                placeholder="john@example.com"
                required
                value={email}
                disabled={disabled}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="contact-phone">Phone</label>
              <input
                id="contact-phone"
                type="tel"
                className="contact-input"
                placeholder="+65 9123 4567"
                value={phone}
                disabled={disabled}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={disabled}>
            Submit details
          </button>
        </form>
      </div>
    </div>
  )
}

export default ContactFormView