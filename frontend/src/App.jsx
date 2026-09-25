import { useEffect, useMemo, useState } from "react";
import foods from "./data/foods";
import Controller from "./Controller";
import "./App.css";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://people-achievement-started-poetry.trycloudflare.com";
const PAYMENT_METHODS = [
  {
    id: "OPay",
    name: "OPay",
    accountName: "Muhammed Binanu Oshioke",
    accountNumber: "7017594363",
  },
  {
    id: "Moniepoint",
    name: "Moniepoint",
    accountName: "Abibat Momoh Aghaokho",
    accountNumber: "5327902652",
  },
  {
    id: "PalmPay",
    name: "PalmPay",
    accountName: "PalmPay",
    accountNumber: "8155608499",
  },
];

const DELIVERY_LOCATIONS = [
  "Ikorodu Garage",
  "Ikorodu Roundabout",
  "Sabo",
  "Agric",
  "Benson",
  "Ebute",
  "Ipakodo",
  "Imota",
  "Igbogbo",
  "Itamaga",
  "Laspotech",
  "Owode-Ibese",
  "Odogunyan",
  "Ibeshe",
  "Parafa",
  "Majidun",
  "Other Ikorodu Area",
];

function formatCurrency(amount) {
  return `₦${Number(amount || 0).toLocaleString("en-NG")}`;
}

function App() {
  const [cart, setCart] = useState([]);

  const [page, setPage] = useState(() => {
    return window.location.pathname === "/controller"
      ? "controller"
      : "home";
  });

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [checkoutForm, setCheckoutForm] = useState({
    name: "",
    phone: "",
    location: "",
    address: "",
  });

  const [paymentMethod, setPaymentMethod] = useState("OPay");
  const [amountPaid, setAmountPaid] = useState("");

  const [orderMessage, setOrderMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [pendingOrder, setPendingOrder] = useState(null);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(
        foods.map((food) => food.category).filter(Boolean)
      ),
    ];

    return ["All", ...uniqueCategories];
  }, []);

  const filteredFoods = useMemo(() => {
    return foods.filter((food) => {
      const matchesCategory =
        activeCategory === "All" ||
        food.category === activeCategory;

      const search = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !search ||
        food.name.toLowerCase().includes(search) ||
        food.description.toLowerCase().includes(search) ||
        food.category.toLowerCase().includes(search);

      return (
        matchesCategory &&
        matchesSearch &&
        food.available !== false
      );
    });
  }, [activeCategory, searchTerm]);

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const subtotal = cart.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );

  const deliveryFee = 0;
  const total = subtotal + deliveryFee;

  const selectedPayment = PAYMENT_METHODS.find(
    (method) => method.id === paymentMethod
  );

  function addToCart(food) {
    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === food.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.id === food.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          ...food,
          quantity: 1,
        },
      ];
    });
  }

  function increaseQuantity(id) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }

  function decreaseQuantity(id) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(id) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== id)
    );
  }

  function clearCart() {
    setCart([]);
  }

  function updateCheckoutField(event) {
    const { name, value } = event.target;

    setCheckoutForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openCheckout() {
    if (cart.length === 0) {
      setOrderMessage(
        "Please add at least one food to your cart."
      );
      setPage("home");
      return;
    }

    setOrderMessage("");
    setPage("checkout");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openCart() {
    setPage("cart");
    setOrderMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function goHome() {
    setPage("home");
    setOrderMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openTerms() {
    setPage("terms");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openController() {
    setPage("controller");
    setOrderMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function submitOrder() {
    if (cart.length === 0) {
      setOrderMessage("Your cart is empty.");
      return;
    }

    if (!checkoutForm.name.trim()) {
      setOrderMessage("Please enter your full name.");
      return;
    }

    if (!checkoutForm.phone.trim()) {
      setOrderMessage("Please enter your phone number.");
      return;
    }

    if (!checkoutForm.location) {
      setOrderMessage(
        "Please select your delivery location."
      );
      return;
    }

    if (!checkoutForm.address.trim()) {
      setOrderMessage(
        "Please enter your delivery address."
      );
      return;
    }

    if (!paymentMethod) {
      setOrderMessage(
        "Please select a payment method."
      );
      return;
    }

    setIsSubmitting(true);
    setOrderMessage("");

    const orderData = {
      customer: {
        name: checkoutForm.name.trim(),
        phone: checkoutForm.phone.trim(),
      },

      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      })),

      subtotal,
      deliveryFee: 0,
      total,

      location: checkoutForm.location,
      address: checkoutForm.address.trim(),

      paymentMethod,
      paymentStatus: "pending",
    };

    try {
      const response = await fetch(
        `${API_URL}/api/orders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to create your order."
        );
      }

      setOrderNumber(data.order.orderNumber);
      setPendingOrder(data.order);
      setAmountPaid("");

      setPage("payment");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setOrderMessage(
        error.message ||
          "Unable to submit your order. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmPayment() {
    if (!orderNumber) {
      setOrderMessage(
        "Order number is missing. Please try again."
      );
      return;
    }

    const numericAmount = Number(
      String(amountPaid).replace(/,/g, "")
    );

    if (
      !amountPaid ||
      Number.isNaN(numericAmount)
    ) {
      setOrderMessage(
        "Please enter the amount you transferred."
      );
      return;
    }

    if (numericAmount <= 0) {
      setOrderMessage(
        "The payment amount must be greater than ₦0."
      );
      return;
    }

    setIsSubmitting(true);
    setOrderMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/orders/${encodeURIComponent(
          orderNumber
        )}/payment-submitted`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amountPaid: numericAmount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to submit payment confirmation."
        );
      }

      setPendingOrder(data.order);

      setPage("pending");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setOrderMessage(
        error.message ||
          "Unable to submit payment confirmation."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /*
   * Check the backend for the latest payment status.
   *
   * IMPORTANT:
   * The customer uses /status while waiting for
   * the controller to confirm the payment.
   */
  async function checkPaymentStatus() {
    if (!orderNumber) {
      return;
    }

    try {
      setIsCheckingPayment(true);

      const response = await fetch(
        `${API_URL}/api/orders/${encodeURIComponent(
          orderNumber
        )}/status`
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (!data.order) {
        return;
      }

      setPendingOrder(data.order);

      if (data.order.paymentStatus === "paid") {
        setConfirmedOrder(data.order);
        setPage("receipt");

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }

      if (
        data.order.paymentStatus ===
        "not_verified"
      ) {
        setOrderMessage(
          "Your payment could not be verified. Please check your payment and contact Foody if you need help."
        );
      }
    } catch (error) {
      console.error(
        "Payment status check failed:",
        error
      );
    } finally {
      setIsCheckingPayment(false);
    }
  }

  /*
   * Automatically checks every 3 seconds while
   * the customer is on the payment-pending page.
   */
  useEffect(() => {
    if (
      page !== "pending" ||
      !orderNumber
    ) {
      return;
    }

    checkPaymentStatus();

    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [page, orderNumber]);

  function showConfirmedReceipt(order) {
    setConfirmedOrder(order);
    setPage("receipt");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container headerInner">
          <button
            className="logoButton"
            onClick={goHome}
          >
            <span className="logoIcon">
              🍴
            </span>

            <span className="logoText">
              Foody
            </span>
          </button>

          <nav className="nav">
            <button
              className={
                page === "home"
                  ? "active"
                  : ""
              }
              onClick={goHome}
            >
              Home
            </button>

            <button onClick={openTerms}>
              Terms
            </button>

            <button
              className="cartNavButton"
              onClick={openCart}
            >
              Cart

              {cartCount > 0 && (
                <span className="cartBadge">
                  {cartCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* HOME */}

        {page === "home" && (
          <>
            <section className="hero">
              <div className="heroText">
                <p className="eyebrow">
                  FRESH • TASTY • DELIVERED
                </p>

                <h1>
                  Delicious food,
                  <br />
                  delivered to you.
                </h1>

                <p>
                  Order your favourite meals
                  from Foody and enjoy fresh,
                  delicious food delivered
                  around Ikorodu.
                </p>

                <button
                  className="primaryButton"
                  onClick={() => {
                    document
                      .getElementById("foodMenu")
                      ?.scrollIntoView({
                        behavior: "smooth",
                      });
                  }}
                >
                  ORDER / MENU
                </button>
              </div>

              <div className="heroImage">
                <img
                  src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=80"
                  alt="Delicious food"
                />
              </div>
            </section>

            <section
              className="menuSection"
              id="foodMenu"
            >
              <div className="container">
                <div className="sectionHeading">
                  <div>
                    <p className="eyebrow">
                      OUR MENU
                    </p>

                    <h2>
                      Choose your food
                    </h2>
                  </div>

                  <div className="searchBox">
                    <input
                      type="text"
                      placeholder="Search food..."
                      value={searchTerm}
                      onChange={(event) =>
                        setSearchTerm(
                          event.target.value
                        )
                      }
                    />
                  </div>
                </div>

                <div className="categoryList">
                  {categories.map(
                    (category) => (
                      <button
                        key={category}
                        className={
                          activeCategory ===
                          category
                            ? "categoryButton active"
                            : "categoryButton"
                        }
                        onClick={() =>
                          setActiveCategory(
                            category
                          )
                        }
                      >
                        {category}
                      </button>
                    )
                  )}
                </div>

                {filteredFoods.length ===
                0 ? (
                  <div className="emptyState">
                    <h3>
                      No food found
                    </h3>

                    <p>
                      Try another search
                      or category.
                    </p>
                  </div>
                ) : (
                  <div className="foodGrid">
                    {filteredFoods.map(
                      (food) => {
                        const quantity =
                          cart.find(
                            (item) =>
                              item.id ===
                              food.id
                          )?.quantity || 0;

                        return (
                          <article
                            className="foodCard"
                            key={food.id}
                          >
                            <div className="foodImage">
                              <img
                                src={food.image}
                                alt={
                                  food.name
                                }
                              />
                            </div>

                            <div className="foodCardBody">
                              <span className="foodCategory">
                                {
                                  food.category
                                }
                              </span>

                              <h3>
                                {food.name}
                              </h3>

                              <p>
                                {
                                  food.description
                                }
                              </p>

                              <div className="foodBottom">
                                <strong>
                                  {formatCurrency(
                                    food.price
                                  )}
                                </strong>

                                <button
                                  className="addButton"
                                  onClick={() =>
                                    addToCart(
                                      food
                                    )
                                  }
                                >
                                  {quantity > 0
                                    ? `Added ${quantity}`
                                    : "Add"}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* CART */}

        {page === "cart" && (
          <section className="pageSection">
            <div className="container">
              <div className="pageHeading">
                <p className="eyebrow">
                  YOUR ORDER
                </p>

                <h1>Your Cart</h1>
              </div>

              {cart.length === 0 ? (
                <div className="emptyState">
                  <h2>
                    Your cart is empty
                  </h2>

                  <p>
                    Add some delicious food
                    to continue.
                  </p>

                  <button
                    className="primaryButton"
                    onClick={goHome}
                  >
                    Browse Food
                  </button>
                </div>
              ) : (
                <div className="cartLayout">
                  <div className="cartItems">
                    {cart.map((item) => (
                      <div
                        className="cartItem"
                        key={item.id}
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                        />

                        <div className="cartItemInfo">
                          <h3>
                            {item.name}
                          </h3>

                          <p>
                            {formatCurrency(
                              item.price
                            )}{" "}
                            each
                          </p>

                          <div className="quantityControls">
                            <button
                              onClick={() =>
                                decreaseQuantity(
                                  item.id
                                )
                              }
                            >
                              −
                            </button>

                            <span>
                              {item.quantity}
                            </span>

                            <button
                              onClick={() =>
                                increaseQuantity(
                                  item.id
                                )
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="cartItemRight">
                          <strong>
                            {formatCurrency(
                              item.price *
                                item.quantity
                            )}
                          </strong>

                          <button
                            className="removeButton"
                            onClick={() =>
                              removeFromCart(
                                item.id
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      className="clearCartButton"
                      onClick={clearCart}
                    >
                      Clear Cart
                    </button>
                  </div>

                  <aside className="summary">
                    <h2>
                      Order Summary
                    </h2>

                    <div className="summaryRow">
                      <span>
                        Subtotal
                      </span>

                      <strong>
                        {formatCurrency(
                          subtotal
                        )}
                      </strong>
                    </div>

                    <div className="summaryRow">
                      <span>
                        Delivery
                      </span>

                      <strong>
                        Free
                      </strong>
                    </div>

                    <div className="summaryTotal">
                      <span>
                        Total
                      </span>

                      <strong>
                        {formatCurrency(
                          total
                        )}
                      </strong>
                    </div>

                    <button
                      className="primaryButton fullButton"
                      onClick={
                        openCheckout
                      }
                    >
                      Continue to Checkout
                    </button>
                  </aside>
                </div>
              )}
            </div>
          </section>
        )}

        {/* CHECKOUT */}

        {page === "checkout" && (
          <section className="pageSection">
            <div className="container">
              <div className="pageHeading">
                <p className="eyebrow">
                  CHECKOUT
                </p>

                <h1>
                  Your Information
                </h1>

                <p>
                  Enter your details before
                  proceeding to payment.
                </p>
              </div>

              <div className="checkoutLayout">
                <div className="checkoutForm">
                  <div className="formCard">
                    <h2>
                      Customer Information
                    </h2>

                    <label>
                      Full Name

                      <input
                        name="name"
                        type="text"
                        placeholder="Enter your full name"
                        value={
                          checkoutForm.name
                        }
                        onChange={
                          updateCheckoutField
                        }
                      />
                    </label>

                    <label>
                      Phone Number

                      <input
                        name="phone"
                        type="tel"
                        placeholder="Enter your phone number"
                        value={
                          checkoutForm.phone
                        }
                        onChange={
                          updateCheckoutField
                        }
                      />
                    </label>

                    <label>
                      Delivery Location

                      <select
                        name="location"
                        value={
                          checkoutForm.location
                        }
                        onChange={
                          updateCheckoutField
                        }
                      >
                        <option value="">
                          Select your
                          Ikorodu
                          location
                        </option>

                        {DELIVERY_LOCATIONS.map(
                          (location) => (
                            <option
                              key={location}
                              value={location}
                            >
                              {location}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <label>
                      Full Delivery Address

                      <textarea
                        name="address"
                        placeholder="Enter your house number, street and other address details"
                        value={
                          checkoutForm.address
                        }
                        onChange={
                          updateCheckoutField
                        }
                        rows="4"
                      />
                    </label>
                  </div>

                  <div className="formCard">
                    <h2>
                      Payment Method
                    </h2>

                    <p className="paymentInstruction">
                      Select where you want
                      to make your payment.
                    </p>

                    <div className="paymentMethods">
                      {PAYMENT_METHODS.map(
                        (method) => (
                          <button
                            type="button"
                            key={method.id}
                            className={
                              paymentMethod ===
                              method.id
                                ? "paymentMethod active"
                                : "paymentMethod"
                            }
                            onClick={() =>
                              setPaymentMethod(
                                method.id
                              )
                            }
                          >
                            <span className="paymentRadio">
                              {paymentMethod ===
                              method.id
                                ? "✓"
                                : ""}
                            </span>

                            <span>
                              <strong>
                                {method.name}
                              </strong>

                              <small>
                                {method.id ===
                                "OPay"
                                  ? "Pay with OPay"
                                  : method.id ===
                                    "Moniepoint"
                                  ? "Pay with Moniepoint"
                                  : "Pay with PalmPay"}
                              </small>
                            </span>
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {orderMessage && (
                    <div className="errorMessage">
                      {orderMessage}
                    </div>
                  )}

                  <button
                    className="primaryButton fullButton"
                    onClick={
                      submitOrder
                    }
                    disabled={
                      isSubmitting
                    }
                  >
                    {isSubmitting
                      ? "Preparing Payment..."
                      : `Proceed to Payment • ${formatCurrency(
                          total
                        )}`}
                  </button>
                </div>

                <aside className="summary">
                  <h2>
                    Your Order
                  </h2>

                  {cart.map((item) => (
                    <div
                      className="checkoutItem"
                      key={item.id}
                    >
                      <span>
                        {item.name} ×{" "}
                        {item.quantity}
                      </span>

                      <strong>
                        {formatCurrency(
                          item.price *
                            item.quantity
                        )}
                      </strong>
                    </div>
                  ))}

                  <div className="summaryRow">
                    <span>
                      Delivery
                    </span>

                    <strong>
                      Free
                    </strong>
                  </div>

                  <div className="summaryTotal">
                    <span>
                      Total
                    </span>

                    <strong>
                      {formatCurrency(
                        total
                      )}
                    </strong>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        )}

        {/* PAYMENT */}

        {page === "payment" && (
          <section className="pageSection">
            <div className="container">
              <div className="paymentPage">
                <p className="eyebrow">
                  PAYMENT
                </p>

                <h1>
                  Make Your Payment
                </h1>

                <p className="paymentIntro">
                  Transfer the exact amount
                  below to the selected{" "}
                  {selectedPayment?.name}{" "}
                  account.
                </p>

                <div className="paymentAmount">
                  <span>
                    Order Total
                  </span>

                  <strong>
                    {formatCurrency(
                      total
                    )}
                  </strong>
                </div>

                <div className="paymentAccountCard">
                  <div className="selectedPaymentLogo">
                    {selectedPayment?.name}
                  </div>

                  <div className="accountDetail">
                    <span>
                      Account Name
                    </span>

                    <strong>
                      {
                        selectedPayment?.accountName
                      }
                    </strong>
                  </div>

                  <div className="accountDetail">
                    <span>
                      Account Number
                    </span>

                    <strong className="accountNumber">
                      {
                        selectedPayment?.accountNumber
                      }
                    </strong>
                  </div>

                  <div className="paymentWarning">
                    <strong>
                      Important
                    </strong>

                    <p>
                      Transfer your payment
                      to the account above.
                      After making the
                      transfer, enter the
                      amount you actually
                      sent below.
                    </p>
                  </div>
                </div>

                <div className="formCard paymentAmountForm">
                  <label>
                    Amount I Paid

                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="Enter the amount you transferred"
                      value={amountPaid}
                      onChange={(event) =>
                        setAmountPaid(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <p className="paymentNote">
                    This is the amount you are
                    reporting that you transferred.
                    The controller will check the
                    actual payment before confirming
                    your order.
                  </p>
                </div>

                {orderMessage && (
                  <div className="errorMessage">
                    {orderMessage}
                  </div>
                )}

                <button
                  className="primaryButton fullButton"
                  onClick={
                    confirmPayment
                  }
                  disabled={
                    isSubmitting
                  }
                >
                  {isSubmitting
                    ? "Submitting..."
                    : "I Have Confirmed Payment"}
                </button>

                <button
                  className="secondaryButton fullButton"
                  onClick={() =>
                    setPage("checkout")
                  }
                  disabled={
                    isSubmitting
                  }
                >
                  Change Payment Method
                </button>

                <p className="paymentNote">
                  Your order will remain pending
                  until the Foody controller checks
                  and confirms your payment.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* PAYMENT PENDING */}

        {page === "pending" && (
          <section className="pageSection">
            <div className="container">
              <div className="successCard">
                <div
                  className="successIcon"
                  style={{
                    color: "#f97316",
                    background: "#fff7ed",
                    borderColor: "#fed7aa",
                  }}
                >
                  !
                </div>

                <p className="eyebrow">
                  PAYMENT PENDING
                </p>

                <h1>
                  Payment Confirmation Received
                </h1>

                <p>
                  Your payment confirmation
                  has been received. The
                  controller will check the
                  payment before your order
                  is confirmed.
                </p>

                {pendingOrder && (
                  <div className="orderNumberBox">
                    <span>
                      Order Number
                    </span>

                    <strong>
                      {
                        pendingOrder.orderNumber
                      }
                    </strong>

                    <br />

                    <span
                      style={{
                        marginTop: "10px",
                      }}
                    >
                      Amount Reported
                    </span>

                    <strong>
                      {formatCurrency(
                        pendingOrder.amountPaid
                      )}
                    </strong>

                    <br />

                    <span
                      style={{
                        marginTop: "10px",
                      }}
                    >
                      Status
                    </span>

                    <strong
                      style={{
                        color: "#f97316",
                      }}
                    >
                      PAYMENT PENDING
                    </strong>
                  </div>
                )}

                <p className="successSmallText">
                  {isCheckingPayment
                    ? "Checking payment confirmation..."
                    : "Waiting for the controller to confirm your payment."}
                </p>

                <p className="successSmallText">
                  Please do not make another
                  payment unless the controller
                  contacts you and asks you to do
                  so.
                </p>

                <button
                  className="primaryButton"
                  onClick={goHome}
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </section>
        )}

        {/* CONFIRMED RECEIPT */}

        {page === "receipt" &&
          confirmedOrder && (
            <section className="pageSection">
              <div className="container">
                <div className="successCard">
                  <div
                    className="successIcon"
                    style={{
                      color: "#16a34a",
                      background: "#f0fdf4",
                      borderColor: "#bbf7d0",
                    }}
                  >
                    ✓
                  </div>

                  <p className="eyebrow">
                    PAYMENT CONFIRMED
                  </p>

                  <h1>
                    Payment Confirmed
                  </h1>

                  <p>
                    Your payment has been
                    checked and confirmed by
                    Foody.
                  </p>

                  <div className="receiptCard">
                    <h2>
                      Payment Receipt
                    </h2>

                    <div className="receiptRow">
                      <span>
                        Order Number
                      </span>

                      <strong>
                        {
                          confirmedOrder.orderNumber
                        }
                      </strong>
                    </div>

                    <div className="receiptRow">
                      <span>
                        Customer
                      </span>

                      <strong>
                        {
                          confirmedOrder
                            .customer?.name
                        }
                      </strong>
                    </div>

                    <div className="receiptRow">
                      <span>
                        Payment Method
                      </span>

                      <strong>
                        {
                          confirmedOrder.paymentMethod
                        }
                      </strong>
                    </div>

                    <div className="receiptRow">
                      <span>
                        Amount Paid
                      </span>

                      <strong>
                        {formatCurrency(
                          confirmedOrder.amountPaid
                        )}
                      </strong>
                    </div>

                    <div className="receiptRow">
                      <span>
                        Payment Status
                      </span>

                      <strong className="confirmedText">
                        CONFIRMED
                      </strong>
                    </div>

                    <div className="receiptRow">
                      <span>
                        Confirmed At
                      </span>

                      <strong>
                        {confirmedOrder.paymentVerifiedAt
                          ? new Date(
                              confirmedOrder.paymentVerifiedAt
                            ).toLocaleString(
                              "en-NG"
                            )
                          : "-"}
                      </strong>
                    </div>

                    <div className="receiptItems">
                      <h3>
                        Food Ordered
                      </h3>

                      {confirmedOrder.items?.map(
                        (item) => (
                          <div
                            className="receiptRow"
                            key={item.id}
                          >
                            <span>
                              {item.name} ×{" "}
                              {
                                item.quantity
                              }
                            </span>

                            <strong>
                              {formatCurrency(
                                item.price *
                                  item.quantity
                              )}
                            </strong>
                          </div>
                        )
                      )}
                    </div>

                    <div className="receiptTotal">
                      <span>
                        Total
                      </span>

                      <strong>
                        {formatCurrency(
                          confirmedOrder.total
                        )}
                      </strong>
                    </div>
                  </div>

                  <button
                    className="primaryButton"
                    onClick={goHome}
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            </section>
          )}

        {/* CONTROLLER */}

        {page === "controller" && (
          <Controller
            apiUrl={API_URL}
            onBack={() => setPage("home")}
          />
        )}

        {/* TERMS */}

        {page === "terms" && (
          <section className="pageSection">
            <div className="container">
              <div className="pageHeading">
                <p className="eyebrow">
                  FOODY
                </p>

                <h1>
                  Terms & Information
                </h1>
              </div>

              <div className="termsCard">
                <section>
                  <h2>
                    1. Ordering
                  </h2>

                  <p>
                    Customers should check
                    their order carefully
                    before submitting it.
                    Orders are processed
                    after payment has been
                    verified.
                  </p>
                </section>

                <section>
                  <h2>
                    2. Delivery Area
                  </h2>

                  <p>
                    Foody currently delivers
                    within Ikorodu, Lagos,
                    Nigeria only.
                  </p>
                </section>

                <section>
                  <h2>
                    3. Delivery Fee
                  </h2>

                  <p>
                    Delivery is currently
                    free.
                  </p>
                </section>

                <section>
                  <h2>
                    4. Payment
                  </h2>

                  <p>
                    Customers can pay using
                    OPay, Moniepoint or
                    PalmPay.
                  </p>
                </section>

                <section>
                  <h2>
                    5. Payment Verification
                  </h2>

                  <p>
                    Clicking "I Have
                    Confirmed Payment" only
                    submits a payment
                    confirmation. The payment
                    remains pending until the
                    Foody controller checks
                    and confirms it.
                  </p>
                </section>

                <section>
                  <h2>
                    6. Customer Care
                  </h2>

                  <p>
                    For assistance:
                    <br />
                    <strong>
                      08167355014
                    </strong>
                    <br />
                    <strong>
                      08155608499
                    </strong>
                  </p>
                </section>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* FOOTER */}

      <footer className="footer">
        <div className="container footerInner">
          <div>
            <h2>Foody</h2>

            <p>
              Your food, your choice,
              delivered around Ikorodu.
            </p>
          </div>

          <div>
            <h3>
              Customer Care
            </h3>

            <p>
              08167355014
            </p>

            <p>
              08155608499
            </p>
          </div>

          <div>
            <h3>
              Delivery
            </h3>

            <p>
              Ikorodu, Lagos, Nigeria
            </p>

            <p>
              Delivery Fee: Free
            </p>

            <button
              onClick={
                openController
              }
              style={{
                marginTop: "12px",
                border: "none",
                background: "transparent",
                color: "#737373",
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              Controller
            </button>
          </div>
        </div>

        <div className="footerBottom">
          © {new Date().getFullYear()}{" "}
          Foody. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default App;
