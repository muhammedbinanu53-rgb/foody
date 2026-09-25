const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

/*
=========================================================
CONFIGURATION
=========================================================
*/

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://192.168.166.204:5173";

const CONTROLLER_PASSWORD =
  process.env.CONTROLLER_PASSWORD ||
  "change-this-controller-password";

const ADMIN_EMAILS = [
  "muhammedbinanu@gmail.com",
];

/*
=========================================================
CORS
=========================================================
*/

const allowedOrigins = [
  FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header.
      // This is useful for direct server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      /*
        Allow LAN addresses using port 5173.

        Example:
        http://192.168.166.204:5173
      */
      if (
        /^http:\/\/192\.168\.\d+\.\d+:5173$/.test(
          origin
        )
      ) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS: Origin not allowed.")
      );
    },
    credentials: false,
  })
);

app.use(express.json());

/*
=========================================================
FILE STORAGE
=========================================================
*/

const ordersFile = path.join(
  __dirname,
  "data",
  "orders.json"
);

function ensureOrdersFile() {
  const dataDirectory = path.join(
    __dirname,
    "data"
  );

  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, {
      recursive: true,
    });
  }

  if (!fs.existsSync(ordersFile)) {
    fs.writeFileSync(
      ordersFile,
      "[]",
      "utf8"
    );
  }
}

ensureOrdersFile();

function readOrders() {
  ensureOrdersFile();

  try {
    return JSON.parse(
      fs.readFileSync(
        ordersFile,
        "utf8"
      )
    );
  } catch (error) {
    console.error(
      "Unable to read orders.json:",
      error.message
    );

    return [];
  }
}

function saveOrders(orders) {
  ensureOrdersFile();

  fs.writeFileSync(
    ordersFile,
    JSON.stringify(
      orders,
      null,
      2
    ),
    "utf8"
  );
}

/*
=========================================================
EMAIL
=========================================================
*/

let transporter = null;

if (
  process.env.GMAIL_USER &&
  process.env.GMAIL_APP_PASSWORD
) {
  transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
  console.log("Gmail is configured.");
} else {
  console.log(
    "Gmail is not configured."
  );
}

/*
=========================================================
HELPER FUNCTIONS
=========================================================
*/

function formatCurrency(amount) {
  return `₦${Number(
    amount || 0
  ).toLocaleString("en-NG")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildItemsText(order) {
  return order.items
    .map(
      (item) =>
        `${item.name} × ${item.quantity} = ${formatCurrency(
          Number(item.price || 0) *
            Number(item.quantity || 0)
        )}`
    )
    .join("\n");
}

function buildItemsHtml(order) {
  return order.items
    .map(
      (item) => `
        <tr>
          <td style="
            padding:8px 0;
            border-bottom:1px solid #eeeeee;
            color:#333333;
            font-size:14px;
          ">
            ${escapeHtml(item.name)}
            × ${Number(item.quantity || 0)}
          </td>

          <td style="
            padding:8px 0;
            border-bottom:1px solid #eeeeee;
            color:#333333;
            font-size:14px;
            text-align:right;
            white-space:nowrap;
          ">
            ${formatCurrency(
              Number(item.price || 0) *
                Number(item.quantity || 0)
            )}
          </td>
        </tr>
      `
    )
    .join("");
}

function createPaymentConfirmationToken() {
  return crypto
    .randomBytes(32)
    .toString("hex");
}

/*
=========================================================
PENDING PAYMENT EMAIL
=========================================================
*/

async function sendPaymentPendingEmail(order) {
  if (!transporter) {
    console.log(
      "Gmail is not configured."
    );

    return false;
  }

  const itemsText =
    buildItemsText(order);

  const itemsHtml =
    buildItemsHtml(order);

  /*
    IMPORTANT:

    This URL must point to the computer running
    the Foody frontend.

    FRONTEND_URL should be set in .env.

    Example:
    FRONTEND_URL=http://192.168.166.204:5173
  */

  const controllerUrl =
    `${FRONTEND_URL}/controller` +
    `?order=${encodeURIComponent(
      order.orderNumber
    )}` +
    `&emailToken=${encodeURIComponent(
      order.paymentConfirmationToken
    )}`;

  const emailText = `
FOODY — PAYMENT PENDING

A customer has submitted a payment confirmation.

ORDER NUMBER
${order.orderNumber}

CUSTOMER
Name: ${order.customer.name}
Phone: ${order.customer.phone}

PAYMENT
Payment Method: ${order.paymentMethod}
Order Total: ${formatCurrency(order.total)}
Amount Customer Says They Paid: ${formatCurrency(
    order.amountPaid
  )}
Payment Status: PENDING

DELIVERY
Location: ${order.location}
Address: ${order.address}

FOOD ORDERED
${itemsText}

SUBTOTAL
${formatCurrency(order.subtotal)}

DELIVERY FEE
Free

ORDER TOTAL
${formatCurrency(order.total)}

IMPORTANT
The customer has reported that payment was made.

Please check the actual payment account before confirming.

Open the Foody controller:
${controllerUrl}
`;

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1.0"
  />

  <title>Foody Payment Pending</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f5f5f5;
  font-family:Arial,Helvetica,sans-serif;
">

  <div style="
    max-width:600px;
    margin:0 auto;
    padding:20px 12px;
  ">

    <div style="
      background:#ffffff;
      border-radius:14px;
      overflow:hidden;
      border:1px solid #eeeeee;
    ">

      <!-- HEADER -->

      <div style="
        background:#f59e0b;
        padding:20px;
        text-align:center;
      ">

        <div style="
          font-size:24px;
          font-weight:800;
          color:#ffffff;
        ">
          FOODY
        </div>

        <div style="
          margin-top:5px;
          font-size:14px;
          color:#fff8e7;
        ">
          Payment Verification Required
        </div>

      </div>

      <!-- BODY -->

      <div style="padding:22px;">

        <div style="
          display:inline-block;
          padding:7px 12px;
          background:#fff3d6;
          color:#d97706;
          border-radius:20px;
          font-size:12px;
          font-weight:700;
          margin-bottom:14px;
        ">
          PAYMENT PENDING
        </div>

        <h2 style="
          margin:0 0 8px;
          color:#222222;
          font-size:22px;
        ">
          Payment confirmation received
        </h2>

        <p style="
          margin:0 0 18px;
          color:#666666;
          font-size:14px;
          line-height:1.5;
        ">
          A customer says they have made payment
          for an order. Please check the actual
          payment account before confirming.
        </p>

        <!-- ORDER -->

        <div style="
          background:#fafafa;
          border-radius:10px;
          padding:15px;
          margin-bottom:16px;
        ">

          <div style="
            font-size:11px;
            color:#888888;
            text-transform:uppercase;
            margin-bottom:4px;
          ">
            Order Number
          </div>

          <div style="
            font-size:18px;
            font-weight:800;
            color:#222222;
          ">
            ${escapeHtml(
              order.orderNumber
            )}
          </div>

        </div>

        <!-- CUSTOMER -->

        <div style="
          border-top:1px solid #eeeeee;
          padding-top:14px;
          margin-top:10px;
        ">

          <h3 style="
            margin:0 0 10px;
            font-size:15px;
            color:#222222;
          ">
            Customer
          </h3>

          <p style="
            margin:5px 0;
            font-size:14px;
            color:#555555;
          ">
            <strong>Name:</strong>
            ${escapeHtml(
              order.customer.name
            )}
          </p>

          <p style="
            margin:5px 0;
            font-size:14px;
            color:#555555;
          ">
            <strong>Phone:</strong>
            ${escapeHtml(
              order.customer.phone
            )}
          </p>

        </div>

        <!-- PAYMENT -->

        <div style="
          border-top:1px solid #eeeeee;
          padding-top:14px;
          margin-top:14px;
        ">

          <h3 style="
            margin:0 0 10px;
            font-size:15px;
            color:#222222;
          ">
            Payment
          </h3>

          <p style="
            margin:5px 0;
            font-size:14px;
            color:#555555;
          ">
            <strong>Method:</strong>
            ${escapeHtml(
              order.paymentMethod
            )}
          </p>

          <p style="
            margin:5px 0;
            font-size:14px;
            color:#555555;
          ">
            <strong>Order Total:</strong>
            ${formatCurrency(
              order.total
            )}
          </p>

          <p style="
            margin:5px 0;
            font-size:14px;
            color:#555555;
          ">
            <strong>Customer Says Paid:</strong>
            ${formatCurrency(
              order.amountPaid
            )}
          </p>

        </div>

        <!-- ITEMS -->

        <div style="
          border-top:1px solid #eeeeee;
          padding-top:14px;
          margin-top:14px;
        ">

          <h3 style="
            margin:0 0 8px;
            font-size:15px;
            color:#222222;
          ">
            Food Ordered
          </h3>

          <table style="
            width:100%;
            border-collapse:collapse;
          ">
            ${itemsHtml}
          </table>

        </div>

        <!-- DELIVERY -->

        <div style="
          border-top:1px solid #eeeeee;
          padding-top:14px;
          margin-top:14px;
        ">

          <h3 style="
            margin:0 0 10px;
            font-size:15px;
            color:#222222;
          ">
            Delivery
          </h3>

          <p style="
            margin:5px 0;
            font-size:14px;
            color:#555555;
          ">
            <strong>Location:</strong>
            ${escapeHtml(
              order.location
            )}
          </p>

          <p style="
            margin:5px 0;
            font-size:14px;
            color:#555555;
          ">
            <strong>Address:</strong>
            ${escapeHtml(
              order.address
            )}
          </p>

        </div>

        <!-- TOTAL -->

        <div style="
          margin-top:18px;
          padding:14px;
          background:#fffaf0;
          border:1px solid #f5dfb1;
          border-radius:10px;
        ">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
          ">

            <span style="
              font-size:14px;
              font-weight:700;
              color:#333333;
            ">
              Order Total
            </span>

            <strong style="
              font-size:20px;
              color:#f59e0b;
            ">
              ${formatCurrency(
                order.total
              )}
            </strong>

          </div>

        </div>

        <!-- WARNING -->

        <div style="
          margin-top:18px;
          padding:13px;
          background:#fff7ed;
          border-left:4px solid #f59e0b;
          border-radius:6px;
        ">

          <strong style="
            display:block;
            color:#9a5b00;
            font-size:13px;
            margin-bottom:4px;
          ">
            IMPORTANT
          </strong>

          <span style="
            color:#6b5a42;
            font-size:12px;
            line-height:1.5;
          ">
            The customer says payment was made.
            Check your actual payment account
            before confirming.
          </span>

        </div>

        <!-- GREEN BUTTON -->

        <div style="
          text-align:center;
          margin:26px 0 14px;
        ">

          <a
            href="${controllerUrl}"
            style="
              display:inline-block;
              background:#16a34a;
              color:#ffffff;
              text-decoration:none;
              font-size:15px;
              font-weight:800;
              padding:14px 25px;
              border-radius:8px;
            "
          >
            ✓ I Have Confirmed Payment
          </a>

        </div>

        <p style="
          margin:0;
          text-align:center;
          color:#888888;
          font-size:11px;
          line-height:1.5;
        ">
          The button opens the Foody controller
          for this order. Confirm only after
          checking your payment account.
        </p>

      </div>

      <!-- FOOTER -->

      <div style="
        padding:14px 20px;
        background:#fafafa;
        border-top:1px solid #eeeeee;
        text-align:center;
      ">

        <span style="
          font-size:11px;
          color:#999999;
        ">
          Foody Order Management
        </span>

      </div>

    </div>

  </div>

</body>
</html>
`;

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: ADMIN_EMAILS,
      subject: `Foody Payment Pending - ${order.orderNumber}`,
      text: emailText,
      html: emailHtml,
    });

    console.log(
      `Pending payment email sent for ${order.orderNumber}`
    );

    return true;
  } catch (error) {
    console.error(
      "Unable to send pending payment email:",
      error.message
    );

    return false;
  }
}

/*
=========================================================
PAYMENT CONFIRMED EMAIL
=========================================================
*/

async function sendPaymentConfirmedEmail(order) {
  if (!transporter) {
    console.log(
      "Gmail is not configured."
    );

    return false;
  }

  const itemsText =
    buildItemsText(order);

  const emailText = `
FOODY — PAYMENT CONFIRMED

Payment has been checked and confirmed.

ORDER NUMBER
${order.orderNumber}

CUSTOMER
Name: ${order.customer.name}
Phone: ${order.customer.phone}

PAYMENT
Payment Method: ${order.paymentMethod}
Amount Paid: ${formatCurrency(
    order.amountPaid
  )}
Payment Status: CONFIRMED
Confirmed At: ${order.paymentVerifiedAt}

DELIVERY
Location: ${order.location}
Address: ${order.address}

FOOD ORDERED
${itemsText}

SUBTOTAL
${formatCurrency(order.subtotal)}

DELIVERY FEE
Free

TOTAL
${formatCurrency(order.total)}

ORDER STATUS
${order.status}

The payment has been manually confirmed by the Foody controller.
`;

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: ADMIN_EMAILS,
      subject: `Foody Payment Confirmed - ${order.orderNumber}`,
      text: emailText,
    });

    console.log(
      `Confirmed payment email sent for ${order.orderNumber}`
    );

    return true;
  } catch (error) {
    console.error(
      "Unable to send confirmed payment email:",
      error.message
    );

    return false;
  }
}

/*
=========================================================
ADMIN CONTROLLER SESSIONS
=========================================================
*/

const adminSessions = new Map();

function createAdminToken() {
  const token =
    crypto
      .randomBytes(32)
      .toString("hex");

  adminSessions.set(
    token,
    {
      createdAt: Date.now(),
    }
  );

  return token;
}

function authenticateController(
  req,
  res,
  next
) {
  const authorization =
    req.headers.authorization || "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return res.status(401).json({
      message:
        "Controller login required.",
    });
  }

  const token =
    authorization.slice(7);

  if (!adminSessions.has(token)) {
    return res.status(401).json({
      message:
        "Controller session is invalid or expired.",
    });
  }

  next();
}

/*
=========================================================
BASIC SERVER TEST
=========================================================
*/

app.get("/", (req, res) => {
  res.json({
    message:
      "Foody backend is running!",
  });
});

/*
=========================================================
CREATE ORDER
=========================================================
*/

app.post(
  "/api/orders",
  (req, res) => {
    try {
      const {
        customer,
        items,
        subtotal,
        deliveryFee,
        total,
        location,
        address,
        paymentMethod,
      } = req.body;

      if (
        !customer?.name ||
        !customer?.phone
      ) {
        return res.status(400).json({
          message:
            "Customer name and phone number are required.",
        });
      }

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          message:
            "Your cart is empty.",
        });
      }

      if (!location) {
        return res.status(400).json({
          message:
            "Delivery location is required.",
        });
      }

      if (!address) {
        return res.status(400).json({
          message:
            "Delivery address is required.",
        });
      }

      const allowedPaymentMethods = [
        "OPay",
        "Moniepoint",
        "PalmPay",
      ];

      if (
        !allowedPaymentMethods.includes(
          paymentMethod
        )
      ) {
        return res.status(400).json({
          message:
            "Please select a valid payment method.",
        });
      }

      const orders =
        readOrders();

      const orderNumber =
        "FOODY-" +
        Date.now()
          .toString()
          .slice(-8);

      const paymentConfirmationToken =
        createPaymentConfirmationToken();

      const newOrder = {
        id: Date.now(),

        orderNumber,

        customer: {
          name: customer.name,
          phone: customer.phone,
        },

        items,

        subtotal:
          Number(subtotal) || 0,

        deliveryFee: 0,

        total:
          Number(total) || 0,

        location,

        address,

        paymentMethod,

        paymentStatus:
          "pending",

        paymentSubmitted:
          false,

        amountPaid: 0,

        paymentSubmittedAt:
          null,

        paymentVerifiedAt:
          null,

        status:
          "awaiting_payment",

        pendingEmailSent:
          false,

        confirmedEmailSent:
          false,

        paymentConfirmationToken,

        createdAt:
          new Date().toISOString(),
      };

      orders.push(newOrder);

      saveOrders(orders);

      res.status(201).json({
        message:
          "Order created. Continue to payment.",

        order: newOrder,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to create order.",
      });
    }
  }
);

/*
=========================================================
CUSTOMER SAYS PAYMENT WAS MADE
=========================================================
*/

app.post(
  "/api/orders/:orderNumber/payment-submitted",
  async (req, res) => {
    try {
      const orders =
        readOrders();

      const orderIndex =
        orders.findIndex(
          (order) =>
            order.orderNumber ===
            req.params.orderNumber
        );

      if (orderIndex === -1) {
        return res.status(404).json({
          message:
            "Order not found.",
        });
      }

      const order =
        orders[orderIndex];

      if (
        order.paymentStatus ===
        "paid"
      ) {
        return res.json({
          message:
            "This payment is already confirmed.",
          order,
        });
      }

      const amountPaid =
        Number(
          String(
            req.body.amountPaid || ""
          ).replace(/,/g, "")
        );

      if (
        !Number.isFinite(
          amountPaid
        ) ||
        amountPaid <= 0
      ) {
        return res.status(400).json({
          message:
            "Please provide the amount you paid.",
        });
      }

      order.amountPaid =
        amountPaid;

      order.paymentSubmitted =
        true;

      order.paymentSubmittedAt =
        new Date().toISOString();

      order.paymentStatus =
        "pending";

      order.status =
        "payment_verification_pending";

      if (
        !order.paymentConfirmationToken
      ) {
        order.paymentConfirmationToken =
          createPaymentConfirmationToken();
      }

      /*
        Save first so the order exists even
        if Gmail has a temporary problem.
      */
      saveOrders(orders);

      const emailSent =
        await sendPaymentPendingEmail(
          order
        );

      order.pendingEmailSent =
        emailSent;

      saveOrders(orders);

      res.json({
        message:
          "Payment confirmation received. Your payment is pending verification.",

        emailSent,

        order,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to submit payment confirmation.",
      });
    }
  }
);

/*
=========================================================
BUYER PAYMENT STATUS
=========================================================

The buyer's pending page calls this endpoint
every few seconds.

This is what allows:

PENDING
   ↓
Controller confirms payment
   ↓
PAID
   ↓
Buyer automatically sees confirmation
=========================================================
*/

app.get(
  "/api/orders/:orderNumber/status",
  (req, res) => {
    try {
      const orders =
        readOrders();

      const order =
        orders.find(
          (item) =>
            item.orderNumber ===
            req.params.orderNumber
        );

      if (!order) {
        return res.status(404).json({
          message:
            "Order not found.",
        });
      }

      /*
        Do NOT send the payment confirmation token
        to the buyer status polling endpoint.
      */

      const safeOrder = {
        orderNumber:
          order.orderNumber,

        customer:
          order.customer,

        items:
          order.items,

        subtotal:
          order.subtotal,

        deliveryFee:
          order.deliveryFee,

        total:
          order.total,

        location:
          order.location,

        address:
          order.address,

        paymentMethod:
          order.paymentMethod,

        paymentStatus:
          order.paymentStatus,

        paymentSubmitted:
          order.paymentSubmitted,

        amountPaid:
          order.amountPaid,

        paymentSubmittedAt:
          order.paymentSubmittedAt,

        paymentVerifiedAt:
          order.paymentVerifiedAt,

        status:
          order.status,

        createdAt:
          order.createdAt,
      };

      res.set(
        "Cache-Control",
        "no-store"
      );

      res.json({
        order: safeOrder,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to check payment status.",
      });
    }
  }
);

/*
=========================================================
CONTROLLER LOGIN
=========================================================
*/

app.post(
  "/api/admin/login",
  (req, res) => {
    const { password } =
      req.body;

    if (
      !password ||
      password !==
        CONTROLLER_PASSWORD
    ) {
      return res.status(401).json({
        message:
          "Incorrect controller password.",
      });
    }

    const token =
      createAdminToken();

    res.json({
      message:
        "Controller login successful.",

      token,
    });
  }
);

/*
=========================================================
CONTROLLER ORDERS
=========================================================
*/

app.get(
  "/api/admin/orders",
  authenticateController,
  (req, res) => {
    try {
      const orders =
        readOrders();

      const sortedOrders =
        [...orders].sort(
          (a, b) =>
            new Date(
              b.createdAt
            ) -
            new Date(
              a.createdAt
            )
        );

      res.json({
        orders:
          sortedOrders,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to load orders.",
      });
    }
  }
);

/*
=========================================================
EMAIL BUTTON → OPEN CONTROLLER
=========================================================
*/

app.get(
  "/api/email-payment/:orderNumber/:token",
  (req, res) => {
    try {
      const {
        orderNumber,
        token,
      } = req.params;

      const orders =
        readOrders();

      const order =
        orders.find(
          (item) =>
            item.orderNumber ===
            orderNumber
        );

      if (!order) {
        return res.status(404).send(`
          <html>
            <body style="
              font-family:Arial;
              text-align:center;
              padding:40px;
            ">
              <h2>Order not found</h2>
              <p>
                This Foody order could not be found.
              </p>
            </body>
          </html>
        `);
      }

      if (
        !order.paymentConfirmationToken ||
        token !==
          order.paymentConfirmationToken
      ) {
        return res.status(403).send(`
          <html>
            <body style="
              font-family:Arial;
              text-align:center;
              padding:40px;
            ">
              <h2>Invalid confirmation link</h2>
              <p>
                This payment confirmation link
                is not valid.
              </p>
            </body>
          </html>
        `);
      }

      const controllerUrl =
        `${FRONTEND_URL}/controller` +
        `?order=${encodeURIComponent(
          order.orderNumber
        )}` +
        `&emailToken=${encodeURIComponent(
          token
        )}`;

      return res.redirect(
        controllerUrl
      );
    } catch (error) {
      console.error(error);

      return res.status(500).send(`
        <html>
          <body style="
            font-family:Arial;
            text-align:center;
            padding:40px;
          ">
            <h2>Something went wrong</h2>
            <p>
              Please open the Foody controller manually.
            </p>
          </body>
        </html>
      `);
    }
  }
);

/*
=========================================================
GET ORDER USING EMAIL TOKEN
=========================================================
*/

app.get(
  "/api/email-payment/:orderNumber/:token/order",
  (req, res) => {
    try {
      const {
        orderNumber,
        token,
      } = req.params;

      const orders =
        readOrders();

      const order =
        orders.find(
          (item) =>
            item.orderNumber ===
            orderNumber
        );

      if (!order) {
        return res.status(404).json({
          message:
            "Order not found.",
        });
      }

      if (
        !order.paymentConfirmationToken ||
        token !==
          order.paymentConfirmationToken
      ) {
        return res.status(403).json({
          message:
            "Invalid payment confirmation link.",
        });
      }

      res.json({
        order,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to load payment information.",
      });
    }
  }
);

/*
=========================================================
CONTROLLER CONFIRMS PAYMENT
=========================================================
*/

app.post(
  "/api/admin/orders/:orderNumber/confirm",
  authenticateController,
  async (req, res) => {
    try {
      const orders =
        readOrders();

      const orderIndex =
        orders.findIndex(
          (order) =>
            order.orderNumber ===
            req.params.orderNumber
        );

      if (orderIndex === -1) {
        return res.status(404).json({
          message:
            "Order not found.",
        });
      }

      const order =
        orders[orderIndex];

      if (
        order.paymentStatus ===
        "paid"
      ) {
        return res.json({
          message:
            "Payment is already confirmed.",
          order,
        });
      }

      if (
        !order.paymentSubmitted
      ) {
        return res.status(400).json({
          message:
            "The customer has not submitted payment confirmation yet.",
        });
      }

      order.paymentStatus =
        "paid";

      order.status =
        "confirmed";

      order.paymentVerifiedAt =
        new Date().toISOString();

      saveOrders(orders);

      const emailSent =
        await sendPaymentConfirmedEmail(
          order
        );

      order.confirmedEmailSent =
        emailSent;

      saveOrders(orders);

      res.json({
        message:
          "Payment confirmed and receipt generated.",

        emailSent,

        order,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to confirm payment.",
      });
    }
  }
);

/*
=========================================================
CONTROLLER REJECTS PAYMENT
=========================================================
*/

app.post(
  "/api/admin/orders/:orderNumber/reject",
  authenticateController,
  (req, res) => {
    try {
      const orders =
        readOrders();

      const orderIndex =
        orders.findIndex(
          (order) =>
            order.orderNumber ===
            req.params.orderNumber
        );

      if (orderIndex === -1) {
        return res.status(404).json({
          message:
            "Order not found.",
        });
      }

      const order =
        orders[orderIndex];

      order.paymentStatus =
        "not_verified";

      order.status =
        "payment_not_verified";

      saveOrders(orders);

      res.json({
        message:
          "Payment marked as not verified.",

        order,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "Unable to reject payment.",
      });
    }
  }
);

/*
=========================================================
START SERVER
=========================================================
*/
app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Foody server running on port ${PORT}`
    );

    console.log(
      `Frontend URL: ${FRONTEND_URL}`
    );

    console.log(
      `Controller: ${FRONTEND_URL}/controller`
    );
  }
);