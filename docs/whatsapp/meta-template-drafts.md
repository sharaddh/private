# Meta Template Drafts

Submit these in WhatsApp Manager. Keep the template name, language, category, and
parameter order aligned with the local mapping in the Communications → Templates tab.
Examples use `{{1}}`, `{{2}}`, … matching the app parameter map.

## Utility templates

### `kmj_order_confirmation`

- Category: Utility
- Language: `en`
- Header: none
- Parameters: `{{1}}` customer name, `{{2}}` order number

```
Hello {{1}}, your order {{2}} has been received by KMJ Optical. We will keep you updated as it progresses. Thank you.
```

### `kmj_order_processing`

- Category: Utility
- Language: `en`
- Parameters: `{{1}}` customer name, `{{2}}` order number

```
Hello {{1}}, your order {{2}} is now being processed at KMJ Optical. We will notify you when it is ready.
```

### `kmj_order_ready`

- Category: Utility
- Language: `en`
- Parameters: `{{1}}` customer name, `{{2}}` order number

```
Hello {{1}}, your order {{2}} is ready for pickup at KMJ Optical. Please visit us at your convenience.
```

### `kmj_order_delivered`

- Category: Utility
- Language: `en`
- Parameters: `{{1}}` customer name, `{{2}}` order number

```
Hello {{1}}, your order {{2}} has been delivered. Thank you for choosing KMJ Optical.
```

### `kmj_order_cancelled`

- Category: Utility
- Language: `en`
- Parameters: `{{1}}` customer name, `{{2}}` order number

```
Hello {{1}}, your order {{2}} has been cancelled. Please contact KMJ Optical if you need assistance.
```

### `kmj_payment_received`

- Category: Utility
- Language: `en`
- Parameters: `{{1}}` customer name, `{{2}}` amount, `{{3}}` bill number

```
Hello {{1}}, we have received your payment of {{2}} against bill {{3}}. Thank you.
```

### `kmj_payment_partial`

- Category: Utility
- Language: `en`
- Parameters: `{{1}}` customer name, `{{2}}` amount received, `{{3}}` pending amount, `{{4}}` bill number

```
Hello {{1}}, we have received {{2}} against bill {{4}}. The remaining balance is {{3}}. Please contact KMJ Optical for any clarification.
```

### `kmj_payment_reminder`

- Category: Utility
- Language: `en`
- Parameters: `{{1}}` customer name, `{{2}}` pending amount, `{{3}}` bill number

```
Hello {{1}}, this is a reminder that {{2}} is pending against bill {{3}}. Please contact KMJ Optical if you have already paid.
```

### `kmj_invoice_document`

- Category: Utility
- Language: `en`
- Header: Document (PDF)
- Parameters: `{{1}}` customer name, `{{2}}` bill number, `{{3}}` total amount
- The app attaches the generated invoice PDF to the document header.

```
Hello {{1}}, your invoice for bill {{2}} is attached. Total amount: {{3}}. Thank you for choosing KMJ Optical.
```

## Marketing template

### `kmj_promotional_offer`

- Category: Marketing
- Language: `en`
- Parameters: `{{1}}` customer name
- Only send to customers with explicit marketing opt-in.

```
Hello {{1}}, KMJ Optical has a special offer for you. Visit our store to learn more about our latest eyewear collection.
```

## Submission notes

- Meta may rewrite or reject copy that resembles the examples; keep the meaning and
  variable count stable.
- Do not add variables that the app does not map; do not remove mapped variables.
- Submit one template at a time and record the approval status.
- After approval, update the local template status to approved and confirm the
  parameter map order in the UI.
- Marketing templates are subject to Meta policy and messaging limits; keep frequency
  low and always honor opt-outs.
