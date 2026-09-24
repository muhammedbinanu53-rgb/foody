import { useEffect, useState, useCallback } from "react";
import "./Controller.css";

function formatCurrency(amount) {
  return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
}

function Controller({ apiUrl, onBack }) {
  const [password, setPassword] = useState("");

  const [token, setToken] = useState(
    localStorage.getItem("foody_controller_token") || ""
  );

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [emailOrderNumber, setEmailOrderNumber] = useState("");
  const [emailToken, setEmailToken] = useState("");

  /*
  =========================================================
  READ ORDER FROM GMAIL LINK
  =========================================================
  */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const order = params.get("order");
    const paymentToken = params.get("emailToken");

    if (order && paymentToken) {
      setEmailOrderNumber(order);
      setEmailToken(paymentToken);

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }, []);

  /*
  =========================================================
  LOGIN
  =========================================================
  */

  async function login() {
    if (!password.trim()) {
      setError("Please enter the controller password.");
      return;
    }

    setLoginLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiUrl}/api/admin/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password,
          }),
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Login failed."
        );
      }

      localStorage.setItem(
        "foody_controller_token",
        data.token
      );

      setToken(data.token);
      setPassword("");

      setMessage(
        "Controller login successful."
      );
    } catch (err) {
      setError(
        err.message || "Unable to login."
      );
    } finally {
      setLoginLoading(false);
    }
  }

  /*
  =========================================================
  LOGOUT
  =========================================================
  */

  function logout() {
    localStorage.removeItem(
      "foody_controller_token"
    );

    setToken("");
    setOrders([]);
    setSelectedOrder(null);
    setMessage("");
    setError("");
  }

  /*
  =========================================================
  LOAD ALL ORDERS
  =========================================================
  */

  const loadOrders = useCallback(
    async (showLoading = false) => {
      if (!token) {
        return;
      }

      if (showLoading) {
        setLoading(true);
      }

      try {
        const response = await fetch(
          `${apiUrl}/api/admin/orders?t=${Date.now()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            logout();
            return;
          }

          throw new Error(
            data.message ||
              "Unable to load orders."
          );
        }

        const receivedOrders =
          Array.isArray(data.orders)
            ? data.orders
            : [];

        /*
        Always use the latest server order list.
        */

        setOrders(receivedOrders);

        /*
        Keep the opened order synchronized.
        */

        if (selectedOrder?.orderNumber) {
          const updatedSelectedOrder =
            receivedOrders.find(
              (order) =>
                order.orderNumber ===
                selectedOrder.orderNumber
            );

          if (updatedSelectedOrder) {
            setSelectedOrder(
              updatedSelectedOrder
            );
          }
        }
      } catch (err) {
        console.error(
          "Controller order loading error:",
          err
        );

        setError(
          err.message ||
            "Unable to load orders."
        );
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [apiUrl, token, selectedOrder]
  );

  /*
  =========================================================
  AUTOMATIC REFRESH
  =========================================================
  */

  useEffect(() => {
    if (!token) {
      return;
    }

    loadOrders(true);

    const interval = setInterval(() => {
      loadOrders(false);
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [token, loadOrders]);

  /*
  =========================================================
  LOAD ORDER FROM GMAIL PAYMENT BUTTON
  =========================================================
  */

  useEffect(() => {
    if (
      !emailOrderNumber ||
      !emailToken
    ) {
      return;
    }

    async function loadEmailOrder() {
      setError("");

      try {
        const response = await fetch(
          `${apiUrl}/api/email-payment/${encodeURIComponent(
            emailOrderNumber
          )}/${encodeURIComponent(
            emailToken
          )}/order?t=${Date.now()}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to open this payment order."
          );
        }

        setSelectedOrder(data.order);

        setMessage(
          `Payment order ${emailOrderNumber} opened from the email.`
        );
      } catch (err) {
        setError(
          err.message ||
            "Unable to open the payment order from the email."
        );
      }
    }

    loadEmailOrder();
  }, [
    apiUrl,
    emailOrderNumber,
    emailToken,
  ]);

  /*
  =========================================================
  SYNCHRONIZE EMAIL ORDER AFTER LOGIN
  =========================================================
  */

  useEffect(() => {
    if (
      !token ||
      !emailOrderNumber ||
      orders.length === 0
    ) {
      return;
    }

    const matchingOrder = orders.find(
      (order) =>
        order.orderNumber ===
        emailOrderNumber
    );

    if (matchingOrder) {
      setSelectedOrder(matchingOrder);
    }
  }, [
    token,
    orders,
    emailOrderNumber,
  ]);

  /*
  =========================================================
  CONFIRM PAYMENT
  =========================================================
  */

  async function confirmPayment(orderNumber) {
    if (!token) {
      setError(
        "Please login to the controller first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiUrl}/api/admin/orders/${encodeURIComponent(
          orderNumber
        )}/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          return;
        }

        throw new Error(
          data.message ||
            "Unable to confirm payment."
        );
      }

      /*
      The backend has confirmed the order.
      */

      const confirmedOrder = data.order;

      /*
      Immediately replace the old order
      with the confirmed version.
      */

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.orderNumber === orderNumber
            ? confirmedOrder
            : order
        )
      );

      /*
      Update the opened order.
      */

      setSelectedOrder(confirmedOrder);

      setMessage(
        `Payment confirmed successfully for ${orderNumber}.`
      );

      /*
      Get the latest order list from the server.
      */

      await loadOrders(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to confirm payment."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  =========================================================
  REJECT PAYMENT
  =========================================================
  */

  async function rejectPayment(orderNumber) {
    const shouldReject = window.confirm(
      "Are you sure this payment should be rejected?"
    );

    if (!shouldReject) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${apiUrl}/api/admin/orders/${encodeURIComponent(
          orderNumber
        )}/reject`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          return;
        }

        throw new Error(
          data.message ||
            "Unable to reject payment."
        );
      }

      /*
      Immediately replace the old order
      with the rejected version.
      */

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.orderNumber === orderNumber
            ? data.order
            : order
        )
      );

      setSelectedOrder(data.order);

      setMessage(
        `Payment for ${orderNumber} was marked as not verified.`
      );

      await loadOrders(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to reject payment."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
  =========================================================
  LOGIN PAGE
  =========================================================
  */

  if (!token) {
    return (
      <section className="controllerPage">
        <div className="controllerLogin">
          <button
            className="controllerBack"
            onClick={onBack}
          >
            ← Back to Foody
          </button>

          <div className="controllerLoginCard">
            <div className="controllerLogo">
              🍴
            </div>

            <p className="controllerEyebrow">
              FOODY CONTROLLER
            </p>

            <h1>
              Controller Login
            </h1>

            <p>
              Login to review customer
              payment confirmations.
            </p>

            {emailOrderNumber && (
              <div
                style={{
                  padding: "12px",
                  marginBottom: "15px",
                  borderRadius: "8px",
                  background: "#fff7ed",
                  border:
                    "1px solid #fed7aa",
                  color: "#9a3412",
                  fontSize: "14px",
                }}
              >
                Payment order received:

                <strong
                  style={{
                    display: "block",
                    marginTop: "4px",
                  }}
                >
                  {emailOrderNumber}
                </strong>
              </div>
            )}

            <label>
              Controller Password

              <input
                type="password"
                placeholder="Enter controller password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    login();
                  }
                }}
              />
            </label>

            {error && (
              <div className="controllerError">
                {error}
              </div>
            )}

            <button
              className="controllerPrimary"
              onClick={login}
              disabled={loginLoading}
            >
              {loginLoading
                ? "Logging in..."
                : "Login"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  /*
  =========================================================
  ORDER FILTERS
  =========================================================

  NEW PAYMENT:
  Only orders that are genuinely waiting
  for payment verification.

  Once confirmed:

  paymentStatus:
  pending → paid

  status:
  payment_verification_pending → confirmed

  Therefore the order automatically leaves
  the New Payment section.
  =========================================================
  */

  const newPendingOrders = orders.filter(
    (order) =>
      order.paymentStatus === "pending" &&
      order.paymentSubmitted === true &&
      order.status ===
        "payment_verification_pending" &&
      !order.paymentVerifiedAt
  );

  /*
  Confirmed orders.
  */

  const confirmedOrders = orders.filter(
    (order) =>
      order.paymentStatus === "paid"
  );

  /*
  Orders that are not new pending
  and not confirmed.
  */

  const otherOrders = orders.filter(
    (order) =>
      !(
        order.paymentStatus ===
          "pending" &&
        order.paymentSubmitted === true &&
        order.status ===
          "payment_verification_pending" &&
        !order.paymentVerifiedAt
      ) &&
      order.paymentStatus !== "paid"
  );

  /*
  =========================================================
  CONTROLLER DASHBOARD
  =========================================================
  */

  return (
    <section className="controllerPage">
      <div className="controllerContainer">

        <div className="controllerHeader">
          <div>
            <p className="controllerEyebrow">
              FOODY CONTROLLER
            </p>

            <h1>
              Payment Orders
            </h1>

            <p>
              Check the actual payment before
              confirming an order.
            </p>
          </div>

          <div className="controllerHeaderButtons">
            <button
              className="controllerRefresh"
              onClick={() =>
                loadOrders(true)
              }
              disabled={loading}
            >
              {loading
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

            <button
              className="controllerLogout"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>

        {message && (
          <div className="controllerSuccess">
            {message}
          </div>
        )}

        {error && (
          <div className="controllerError">
            {error}
          </div>
        )}

        {/* =================================================
            STATISTICS
        ================================================= */}

        <div className="controllerStats">

          <div>
            <span>
              New Payments
            </span>

            <strong>
              {newPendingOrders.length}
            </strong>
          </div>

          <div>
            <span>
              Confirmed
            </span>

            <strong>
              {confirmedOrders.length}
            </strong>
          </div>

          <div>
            <span>
              Total Orders
            </span>

            <strong>
              {orders.length}
            </strong>
          </div>

        </div>

        {/* =================================================
            NEW PAYMENT CONFIRMATIONS
        ================================================= */}

        <div
          style={{
            marginTop: "30px",
            marginBottom: "15px",
          }}
        >
          <h2>
            🔴 New Payment Confirmations
          </h2>

          <p
            style={{
              color: "#777",
              marginTop: "5px",
            }}
          >
            New customer payment confirmations
            that have not been processed yet.
          </p>
        </div>

        {newPendingOrders.length === 0 ? (
          <div className="controllerEmpty">
            <div>✓</div>

            <h2>
              No new payment confirmations
            </h2>

            <p>
              New customer payment confirmations
              will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="controllerOrders">

            {newPendingOrders.map(
              (order) => (
                <OrderCard
                  key={order.orderNumber}
                  order={order}
                  loading={loading}
                  onView={() =>
                    setSelectedOrder(
                      order
                    )
                  }
                  onConfirm={() =>
                    confirmPayment(
                      order.orderNumber
                    )
                  }
                  onReject={() =>
                    rejectPayment(
                      order.orderNumber
                    )
                  }
                />
              )
            )}

          </div>
        )}

        {/* =================================================
            CONFIRMED ORDERS
        ================================================= */}

        {confirmedOrders.length > 0 && (
          <>
            <div
              style={{
                marginTop: "45px",
                marginBottom: "15px",
              }}
            >
              <h2>
                Confirmed Orders
              </h2>

              <p
                style={{
                  color: "#777",
                  marginTop: "5px",
                }}
              >
                Payments that have already
                been confirmed.
              </p>
            </div>

            <div className="controllerOrders">

              {confirmedOrders.map(
                (order) => (
                  <OrderCard
                    key={order.orderNumber}
                    order={order}
                    loading={loading}
                    onView={() =>
                      setSelectedOrder(
                        order
                      )
                    }
                    onConfirm={null}
                    onReject={null}
                  />
                )
              )}

            </div>
          </>
        )}

        {/* =================================================
            OTHER ORDERS
        ================================================= */}

        {otherOrders.length > 0 && (
          <>
            <div
              style={{
                marginTop: "45px",
                marginBottom: "15px",
              }}
            >
              <h2>
                Other Orders
              </h2>
            </div>

            <div className="controllerOrders">

              {otherOrders.map(
                (order) => (
                  <OrderCard
                    key={order.orderNumber}
                    order={order}
                    loading={loading}
                    onView={() =>
                      setSelectedOrder(
                        order
                      )
                    }
                    onConfirm={null}
                    onReject={null}
                  />
                )
              )}

            </div>
          </>
        )}

        {/* =================================================
            ORDER DETAILS MODAL
        ================================================= */}

        {selectedOrder && (
          <div className="receiptOverlay">

            <div className="receiptModal">

              <button
                className="receiptClose"
                onClick={() =>
                  setSelectedOrder(null)
                }
              >
                ×
              </button>

              <p className="controllerEyebrow">
                FOODY
              </p>

              <h2>
                {selectedOrder.paymentStatus ===
                "paid"
                  ? "Payment Receipt"
                  : "Order Details"}
              </h2>

              <div className="receiptStatus">

                {selectedOrder.paymentStatus ===
                "paid"
                  ? "✓ PAYMENT CONFIRMED"
                  : selectedOrder.paymentStatus ===
                    "not_verified"
                  ? "✕ PAYMENT NOT VERIFIED"
                  : "🟠 PAYMENT PENDING"}

              </div>

              <div className="receiptRows">

                <div>
                  <span>
                    Order Number
                  </span>

                  <strong>
                    {
                      selectedOrder.orderNumber
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Customer
                  </span>

                  <strong>
                    {
                      selectedOrder.customer
                        ?.name
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Phone
                  </span>

                  <strong>
                    {
                      selectedOrder.customer
                        ?.phone
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Payment Method
                  </span>

                  <strong>
                    {
                      selectedOrder.paymentMethod
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Customer Reported
                  </span>

                  <strong>
                    {formatCurrency(
                      selectedOrder.amountPaid
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Order Total
                  </span>

                  <strong>
                    {formatCurrency(
                      selectedOrder.total
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Delivery Location
                  </span>

                  <strong>
                    {selectedOrder.location}
                  </strong>
                </div>

                <div>
                  <span>
                    Address
                  </span>

                  <strong>
                    {selectedOrder.address}
                  </strong>
                </div>

              </div>

              <div className="receiptFoodList">

                <h3>
                  Food Ordered
                </h3>

                {selectedOrder.items?.map(
                  (item, index) => (
                    <div
                      className="receiptFood"
                      key={`${item.id || item.name}-${index}`}
                    >
                      <span>
                        {item.name} ×{" "}
                        {item.quantity}
                      </span>

                      <strong>
                        {formatCurrency(
                          Number(
                            item.price || 0
                          ) *
                            Number(
                              item.quantity ||
                                0
                            )
                        )}
                      </strong>
                    </div>
                  )
                )}

              </div>

              {selectedOrder.paymentStatus ===
                "paid" && (
                <div className="receiptConfirmedBox">

                  <strong>
                    PAYMENT CONFIRMED
                  </strong>

                  <span>
                    {selectedOrder.paymentVerifiedAt
                      ? new Date(
                          selectedOrder.paymentVerifiedAt
                        ).toLocaleString(
                          "en-NG"
                        )
                      : ""}
                  </span>

                </div>
              )}

              {selectedOrder.paymentStatus ===
                "pending" &&
                selectedOrder.paymentSubmitted &&
                selectedOrder.status ===
                  "payment_verification_pending" && (
                  <div className="receiptActionArea">

                    <button
                      className="confirmPaymentButton fullControllerButton"
                      onClick={() =>
                        confirmPayment(
                          selectedOrder.orderNumber
                        )
                      }
                      disabled={loading}
                    >
                      ✓ I Have Confirmed
                      Payment
                    </button>

                    <button
                      className="rejectPaymentButton fullControllerButton"
                      onClick={() =>
                        rejectPayment(
                          selectedOrder.orderNumber
                        )
                      }
                      disabled={loading}
                    >
                      Reject Payment
                    </button>

                  </div>
                )}

            </div>

          </div>
        )}

      </div>
    </section>
  );
}

/*
=========================================================
ORDER CARD
=========================================================
*/

function OrderCard({
  order,
  loading,
  onView,
  onConfirm,
  onReject,
}) {
  const isPending =
    order.paymentStatus === "pending" &&
    order.paymentSubmitted === true &&
    order.status ===
      "payment_verification_pending" &&
    !order.paymentVerifiedAt;

  const isPaid =
    order.paymentStatus === "paid";

  return (
    <article
      className={
        isPending
          ? "controllerOrder pending"
          : "controllerOrder"
      }
    >

      <div className="orderTop">

        <div>

          <span className="orderNumber">
            {order.orderNumber}
          </span>

          <h2>
            {order.customer?.name}
          </h2>

          <p>
            {order.customer?.phone}
          </p>

        </div>

        <span
          className={
            isPaid
              ? "statusBadge confirmed"
              : isPending
              ? "statusBadge pending"
              : "statusBadge"
          }
        >
          {isPaid
            ? "PAYMENT CONFIRMED"
            : isPending
            ? "PAYMENT PENDING"
            : String(
                order.status || ""
              ).replace(
                /_/g,
                " "
              )}
        </span>

      </div>

      <div className="orderDetailsGrid">

        <div>
          <span>
            Payment Method
          </span>

          <strong>
            {order.paymentMethod}
          </strong>
        </div>

        <div>
          <span>
            Order Total
          </span>

          <strong>
            {formatCurrency(
              order.total
            )}
          </strong>
        </div>

        <div>
          <span>
            Customer Reported
          </span>

          <strong className="reportedAmount">
            {formatCurrency(
              order.amountPaid
            )}
          </strong>
        </div>

        <div>
          <span>
            Location
          </span>

          <strong>
            {order.location}
          </strong>
        </div>

      </div>

      <div className="orderAddress">

        <span>
          Delivery Address
        </span>

        <strong>
          {order.address}
        </strong>

      </div>

      <div className="orderFoods">

        <h3>
          Food Ordered
        </h3>

        {order.items?.map(
          (item, index) => (
            <div
              className="controllerFood"
              key={`${item.id || item.name}-${index}`}
            >

              <span>
                {item.name} ×{" "}
                {item.quantity}
              </span>

              <strong>
                {formatCurrency(
                  Number(
                    item.price || 0
                  ) *
                    Number(
                      item.quantity ||
                        0
                    )
                )}
              </strong>

            </div>
          )
        )}

      </div>

      <div className="controllerOrderActions">

        <button
          className="viewOrderButton"
          onClick={onView}
        >
          View Details
        </button>

        {isPending &&
          onConfirm &&
          onReject && (
            <>
              <button
                className="rejectPaymentButton"
                onClick={onReject}
                disabled={loading}
              >
                Reject Payment
              </button>

              <button
                className="confirmPaymentButton"
                onClick={onConfirm}
                disabled={loading}
              >
                ✓ I Have Confirmed
                Payment
              </button>
            </>
          )}

      </div>

    </article>
  );
}

export default Controller;