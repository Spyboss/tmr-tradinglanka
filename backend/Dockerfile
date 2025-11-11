# Using Node.js 22 bookworm-slim variant for better security and stability
# This is the recommended tag for production use
FROM node:22-bookworm-slim AS builder

# Set working directory
WORKDIR /app

# Copy package.json first for better caching
COPY package*.json ./

# Install dependencies with exact versions for better security
RUN npm ci --only=production

# Create directories
RUN mkdir -p src/utils src/models src/services templates

# Create logger.js
RUN printf "%s" 'const logger = {\n\
  error: (message) => console.error(message),\n\
  warn: (message) => console.warn(message),\n\
  info: (message) => console.info(message),\n\
  http: (message) => console.log(message),\n\
  debug: (message) => console.debug(message),\n\
};\n\
\n\
module.exports = logger;' > src/utils/logger.js

# Create database.js
RUN printf "%s" 'const mongoose = require("mongoose");\n\
const logger = require("./logger");\n\
\n\
// Connect to MongoDB\n\
const connectToDatabase = async () => {\n\
  try {\n\
    const options = {\n\
      useNewUrlParser: true,\n\
      useUnifiedTopology: true,\n\
    };\n\
    \n\
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/tmr";\n\
    await mongoose.connect(uri, options);\n\
    \n\
    logger.info("Connected to MongoDB successfully");\n\
    return mongoose.connection;\n\
  } catch (error) {\n\
    logger.error(`Error connecting to MongoDB: ${error.message}`);\n\
    throw error;\n\
  }\n\
};\n\
\n\
module.exports = { connectToDatabase };' > src/utils/database.js

# Create simplified pdfService.js with basic functionality
RUN printf "%s" 'const PDFDocument = require("pdfkit");\n\
const logger = require("../utils/logger");\n\
\n\
// Helper function to safely convert to string\n\
const safeToString = (val) => {\n\
  if (val === undefined || val === null) return "";\n\
  return val.toString();\n\
};\n\
\n\
// Format currency in LKR\n\
const formatCurrency = (amount) => {\n\
  return `${Number(amount).toLocaleString("en-LK")}/-`;\n\
};\n\
\n\
// Function to generate PDF from bill data\n\
exports.generatePDF = async (bill) => {\n\
  return new Promise((resolve, reject) => {\n\
    try {\n\
      // Create a new PDF document\n\
      const doc = new PDFDocument({ margin: 50, size: "A4" });\n\
      \n\
      // Create buffer to store PDF\n\
      const buffers = [];\n\
      doc.on("data", buffers.push.bind(buffers));\n\
      doc.on("end", () => {\n\
        const pdfData = Buffer.concat(buffers);\n\
        resolve(pdfData);\n\
      });\n\
      \n\
      // Add font and color styling\n\
      doc.font("Helvetica-Bold");\n\
      doc.fillColor("#000080"); // Dark blue for header\n\
      \n\
      // Header with company logo/name\n\
      doc.fontSize(18).text("TMR TRADING LANKA (PVT) LTD", { align: "center" });\n\
      doc.fillColor("#000000"); // Back to black text\n\
      doc.fontSize(11).moveDown(0.5);\n\
      doc.font("Helvetica-Bold").text("TMR TRADING LANKA (PVT) LTD, EMBILIPITIYA", { align: "left" });\n\
      doc.text("AUTHORIZED DEALER - EMBILIPITIYA", { align: "left" });\n\
      \n\
      // Bill Number and Date - At the top right\n\
      const billNumber = bill.billNumber || bill.bill_number || "N/A";\n\
      doc.fillColor("#000080"); // Dark blue for header\n\
      doc.text(`Bill No: ${billNumber}`, 400, 50, { align: "right" });\n\
      \n\
      const today = new Date(bill.serviceDate || bill.date || Date.now());\n\
      const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;\n\
      doc.text(`Date: ${formattedDate}`, 400, 70, { align: "right" });\n\
      doc.fillColor("#000000"); // Back to black text\n\
      \n\
      // Customer Details section\n\
      doc.moveDown(1.5);\n\
      doc.fillColor("#000080"); // Dark blue for section headers\n\
      doc.font("Helvetica-Bold").fontSize(12).text("Customer Details:", { underline: true });\n\
      doc.fillColor("#000000"); // Back to black text\n\
      doc.moveDown(0.5);\n\
      doc.font("Helvetica").fontSize(11);\n\
      doc.text(`Name: ${bill.customerName || bill.customer_name || "N/A"}`);\n\
      doc.text(`NIC: ${bill.customer_nic || "N/A"}`);\n\
      doc.text(`Address: ${bill.customer_address || "N/A"}`);\n\
      \n\
      // Vehicle Details section\n\
      doc.moveDown(1);\n\
      doc.fillColor("#000080"); // Dark blue for section headers\n\
      doc.font("Helvetica-Bold").fontSize(12).text("Vehicle Details:", { underline: true });\n\
      doc.fillColor("#000000"); // Back to black text\n\
      doc.moveDown(0.5);\n\
      doc.font("Helvetica").fontSize(11);\n\
      doc.text(`Model: ${bill.model_name || "N/A"}`);\n\
      if (bill.engine_number) doc.text(`Motor Number: ${bill.engine_number}`);\n\
      if (bill.chassis_number) doc.text(`Chassis Number: ${bill.chassis_number}`);\n\
      \n\
      // Determine if bike is e-bicycle\n\
      const isEbicycle = bill.is_ebicycle || \n\
                        bill.model_name?.includes("COLA5") || \n\
                        bill.model_name?.includes("X01");\n\
      \n\
      // Payment Details section\n\
      doc.moveDown(1);\n\
      doc.fillColor("#000080"); // Dark blue for section headers\n\
      doc.font("Helvetica-Bold").fontSize(12).text("Payment Details:", { underline: true });\n\
      doc.fillColor("#000000"); // Back to black text\n\
      doc.moveDown(0.5);\n\
      \n\
      // Create payment table with borders and cleaner styling\n\
      const tableTop = doc.y;\n\
      const tableLeft = 50;\n\
      const colWidth = 250;\n\
      const amountColWidth = 220;\n\
      const rowHeight = 25;\n\
      \n\
      // Table styling\n\
      doc.lineWidth(1);\n\
      doc.strokeColor("#000080"); // Dark blue for table borders\n\
      \n\
      // Table headers\n\
      doc.rect(tableLeft, tableTop, colWidth, rowHeight).fill("#f0f0f0").stroke();\n\
      doc.rect(tableLeft + colWidth, tableTop, amountColWidth, rowHeight).fill("#f0f0f0").stroke();\n\
      doc.fillColor("#000000");\n\
      doc.font("Helvetica-Bold").fontSize(11);\n\
      doc.text("Description", tableLeft + 10, tableTop + 8);\n\
      doc.text("Amount (Rs.)", tableLeft + colWidth + 10, tableTop + 8);\n\
      \n\
      let currentY = tableTop + rowHeight;\n\
      let totalAmount = 0;\n\
      doc.font("Helvetica").fontSize(10);\n\
      \n\
      // Handle different bill types\n\
      if (bill.bill_type === "leasing") {\n\
        // Leasing bills - only for regular bikes\n\
        const bikePrice = Number(bill.bike_price || bill.price || bill.subtotal || 0);\n\
        const cpzAmount = isEbicycle ? 0 : 13500;\n\
        const downPayment = Number(bill.down_payment || bill.advance || 0);\n\
        \n\
        // Bike Price\n\
        doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
        doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
        doc.text("Bike Price", tableLeft + 10, currentY + 8);\n\
        doc.text(formatCurrency(bikePrice), tableLeft + colWidth + 10, currentY + 8);\n\
        currentY += rowHeight;\n\
        \n\
        // CPZ Charge (if not e-bicycle)\n\
        if (!isEbicycle) {\n\
          doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
          doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
          doc.text("CPZ Charge", tableLeft + 10, currentY + 8);\n\
          doc.text(formatCurrency(cpzAmount), tableLeft + colWidth + 10, currentY + 8);\n\
          currentY += rowHeight;\n\
        }\n\
        \n\
        // Down Payment\n\
        doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
        doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
        doc.text("Down Payment", tableLeft + 10, currentY + 8);\n\
        doc.text(formatCurrency(downPayment), tableLeft + colWidth + 10, currentY + 8);\n\
        currentY += rowHeight;\n\
        \n\
        // For leasing, total amount is the down payment\n\
        totalAmount = downPayment;\n\
        \n\
      } else if (bill.advance && Number(bill.advance) > 0) {\n\
        // Advance Payment bill (either for cash or leasing)\n\
        const bikePrice = Number(bill.bike_price || bill.price || bill.subtotal || 0);\n\
        const rmvAmount = isEbicycle ? 0 : (bill.bill_type === "leasing" ? 13500 : 13000);\n\
        const rmvLabel = bill.bill_type === "leasing" ? "CPZ Charge" : "RMV Charge";\n\
        const advanceAmount = Number(bill.advance || 0);\n\
        \n\
        // Bike Price\n\
        doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
        doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
        doc.text("Bike Price", tableLeft + 10, currentY + 8);\n\
        doc.text(formatCurrency(bikePrice), tableLeft + colWidth + 10, currentY + 8);\n\
        currentY += rowHeight;\n\
        \n\
        // RMV/CPZ Charge (if not e-bicycle)\n\
        if (!isEbicycle) {\n\
          doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
          doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
          doc.text(rmvLabel, tableLeft + 10, currentY + 8);\n\
          doc.text(formatCurrency(rmvAmount), tableLeft + colWidth + 10, currentY + 8);\n\
          currentY += rowHeight;\n\
        }\n\
        \n\
        // If leasing, show down payment\n\
        let fullAmount = bikePrice + rmvAmount;\n\
        if (bill.bill_type === "leasing" && bill.down_payment) {\n\
          const downPayment = Number(bill.down_payment || 0);\n\
          doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
          doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
          doc.text("Down Payment", tableLeft + 10, currentY + 8);\n\
          doc.text(formatCurrency(downPayment), tableLeft + colWidth + 10, currentY + 8);\n\
          currentY += rowHeight;\n\
          fullAmount = downPayment; // For leasing, full amount is down payment\n\
        }\n\
        \n\
        // Advance Amount\n\
        doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
        doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
        doc.text("Advance Amount", tableLeft + 10, currentY + 8);\n\
        doc.text(formatCurrency(advanceAmount), tableLeft + colWidth + 10, currentY + 8);\n\
        currentY += rowHeight;\n\
        \n\
        // Balance\n\
        const balance = fullAmount - advanceAmount;\n\
        doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
        doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
        doc.text("Balance", tableLeft + 10, currentY + 8);\n\
        doc.text(formatCurrency(balance), tableLeft + colWidth + 10, currentY + 8);\n\
        currentY += rowHeight;\n\
        \n\
        // For advance payment, total is the full amount\n\
        totalAmount = fullAmount;\n\
        \n\
      } else {\n\
        // Regular Cash bill\n\
        const bikePrice = Number(bill.bike_price || bill.price || bill.subtotal || 0);\n\
        const rmvAmount = isEbicycle ? 0 : 13000;\n\
        \n\
        // Bike Price\n\
        doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
        doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
        doc.text("Bike Price", tableLeft + 10, currentY + 8);\n\
        doc.text(formatCurrency(bikePrice), tableLeft + colWidth + 10, currentY + 8);\n\
        currentY += rowHeight;\n\
        \n\
        // RMV Charge (if not e-bicycle)\n\
        if (!isEbicycle) {\n\
          doc.rect(tableLeft, currentY, colWidth, rowHeight).stroke();\n\
          doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).stroke();\n\
          doc.text("RMV Charge", tableLeft + 10, currentY + 8);\n\
          doc.text(formatCurrency(rmvAmount), tableLeft + colWidth + 10, currentY + 8);\n\
          currentY += rowHeight;\n\
        }\n\
        \n\
        // For cash, total amount is bike price + RMV (if applicable)\n\
        totalAmount = bikePrice + rmvAmount;\n\
      }\n\
      \n\
      // Total Amount (highlighted)\n\
      doc.rect(tableLeft, currentY, colWidth, rowHeight).fill("#f0f0f0").stroke();\n\
      doc.rect(tableLeft + colWidth, currentY, amountColWidth, rowHeight).fill("#f0f0f0").stroke();\n\
      doc.fillColor("#000080");\n\
      doc.font("Helvetica-Bold").fontSize(11);\n\
      doc.text("Total Amount", tableLeft + 10, currentY + 8);\n\
      doc.text(formatCurrency(totalAmount), tableLeft + colWidth + 10, currentY + 8);\n\
      doc.fillColor("#000000");\n\
      \n\
      // Terms and Conditions section\n\
      doc.moveDown(2);\n\
      doc.fillColor("#000080");\n\
      doc.font("Helvetica-Bold").fontSize(11).text("Terms and Conditions:", { underline: true });\n\
      doc.fillColor("#000000");\n\
      doc.moveDown(0.3);\n\
      doc.font("Helvetica").fontSize(10);\n\
      doc.text("1. All prices are inclusive of taxes.");\n\
      doc.text("2. Warranty is subject to terms and conditions.");\n\
      doc.text("3. This is a computer-generated bill.");\n\
      doc.text("4. RMV registration will be completed within 30 days.");\n\
      \n\
      // Signature lines\n\
      doc.moveDown(2);\n\
      doc.strokeColor("#000000");\n\
      doc.lineWidth(0.5);\n\
      doc.moveTo(50, doc.y).lineTo(200, doc.y).stroke();\n\
      doc.text("Dealer Signature", 50, doc.y + 5);\n\
      \n\
      doc.moveTo(350, doc.y - 15).lineTo(500, doc.y - 15).stroke();\n\
      doc.text("Rubber Stamp", 350, doc.y + 5);\n\
      \n\
      // Footer\n\
      doc.moveDown(1);\n\
      doc.fillColor("#000080");\n\
      doc.fontSize(10).text("Thank you for your business!", { align: "center" });\n\
      \n\
      // Finalize PDF\n\
      doc.end();\n\
    } catch (error) {\n\
      logger.error(`Error generating PDF: ${error.message}`);\n\
      reject(error);\n\
    }\n\
  });\n\
};' > src/services/pdfService.js

# Create BikeModel schema
RUN printf "%s" 'const mongoose = require("mongoose");\n\
\n\
const BikeModelSchema = new mongoose.Schema({\n\
  name: {\n\
    type: String,\n\
    required: [true, "Model name is required"],\n\
    trim: true\n\
  },\n\
  model_name: {\n\
    type: String,\n\
    trim: true\n\
  },\n\
  price: {\n\
    type: Number,\n\
    required: [true, "Price is required"]\n\
  },\n\
  motor_number_prefix: {\n\
    type: String,\n\
    trim: true\n\
  },\n\
  chassis_number_prefix: {\n\
    type: String,\n\
    trim: true\n\
  },\n\
  is_ebicycle: {\n\
    type: Boolean,\n\
    default: false\n\
  },\n\
  can_be_leased: {\n\
    type: Boolean,\n\
    default: true\n\
  }\n\
}, {\n\
  timestamps: true,\n\
  versionKey: false,\n\
  collection: "bike_models", // Set the collection name explicitly\n\
  toJSON: {\n\
    virtuals: true,\n\
    transform: function(doc, ret) {\n\
      ret.id = ret._id;\n\
      ret.model_name = ret.name; // Map name to model_name for frontend compatibility\n\
      delete ret._id;\n\
      delete ret.__v;\n\
      return ret;\n\
    }\n\
  }\n\
});\n\
\n\
// Add middleware to sync name and model_name fields\n\
BikeModelSchema.pre("save", function(next) {\n\
  if (this.isModified("name")) {\n\
    this.model_name = this.name;\n\
  } else if (this.isModified("model_name")) {\n\
    this.name = this.model_name;\n\
  }\n\
  next();\n\
});\n\
\n\
module.exports = mongoose.model("BikeModel", BikeModelSchema);' > src/models/BikeModel.js

# Create src/models/Bill.js with proper schema definition
RUN printf "%s" 'const mongoose = require("mongoose");\n\
\n\
const BillSchema = new mongoose.Schema(\n\
  {\n\
    bill_type: {\n\
      type: String,\n\
      enum: ["cash", "leasing", "advance"],\n\
      required: [true, "Bill type is required"],\n\
    },\n\
    bill_status: {\n\
      type: String,\n\
      enum: ["pending", "paid", "cancelled"],\n\
      default: "pending",\n\
    },\n\
    billNumber: {\n\
      type: String,\n\
      // Generate a unique bill number with date and random component\n\
      default: function() {\n\
        const date = new Date();\n\
        const year = date.getFullYear();\n\
        const month = String(date.getMonth() + 1).padStart(2, "0");\n\
        const day = String(date.getDate()).padStart(2, "0");\n\
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");\n\
        return `TMR-${year}${month}${day}-${random}`;\n\
      },\n\
    },\n\
    bill_number: String, // For backward compatibility\n\
    date: {\n\
      type: Date,\n\
      default: Date.now,\n\
    },\n\
    customerName: String,\n\
    customer_name: String,\n\
    customer_nic: String,\n\
    customer_address: String,\n\
    customer_phone: String,\n\
    model_name: String,\n\
    bike_price: Number,\n\
    is_ebicycle: {\n\
      type: Boolean,\n\
      default: false,\n\
    },\n\
    price: Number,\n\
    subtotal: Number,\n\
    advance: Number,\n\
    down_payment: Number,\n\
    engine_number: String,\n\
    chassis_number: String,\n\
    serviceDate: Date,\n\
    leasing_company: String,\n\
    leasing_amount: Number,\n\
  },\n\
  { timestamps: true }\n\
);\n\
\n\
// Ensure billNumber and bill_number sync and are never null\n\
BillSchema.pre("save", function (next) {\n\
  // Make sure billNumber is set\n\
  if (!this.billNumber) {\n\
    const date = new Date();\n\
    const year = date.getFullYear();\n\
    const month = String(date.getMonth() + 1).padStart(2, "0");\n\
    const day = String(date.getDate()).padStart(2, "0");\n\
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");\n\
    this.billNumber = `TMR-${year}${month}${day}-${random}`;\n\
  }\n\
  \n\
  // Sync bill_number for backward compatibility\n\
  this.bill_number = this.billNumber;\n\
  \n\
  // Auto-detect e-bicycle based on model name\n\
  if (this.model_name && (this.model_name.includes("COLA5") || this.model_name.includes("X01"))) {\n\
    this.is_ebicycle = true;\n\
  }\n\
  \n\
  next();\n\
});\n\
\n\
// Create index separately to avoid Docker parsing issues\n\
BillSchema.index({billNumber: 1});\n\
\n\
const Bill = mongoose.model("Bill", BillSchema, "bills");\n\
\n\
module.exports = Bill;' > src/models/Bill.js

# Create server.js
RUN printf "%s" '// server.js\n\
const express = require("express");\n\
const cors = require("cors");\n\
const mongoose = require("mongoose");\n\
const morgan = require("morgan");\n\
const path = require("path");\n\
const logger = require("./utils/logger");\n\
const { connectToDatabase } = require("./utils/database");\n\
const PDFDocument = require("pdfkit");\n\
const fs = require("fs");\n\
\n\
// Models\n\
const Bill = require("./models/Bill");\n\
const BikeModel = require("./models/BikeModel");\n\
\n\
// App Setup\n\
const app = express();\n\
const port = process.env.PORT || 8080;\n\
\n\
// CORS configuration - Simplified for reliability\n\
app.use((req, res, next) => {\n\
  // Log each request for debugging\n\
  logger.info(`${req.method} ${req.path} from origin: ${req.headers.origin}`);\n\
  \n\
  // Set CORS headers directly\n\
  res.header("Access-Control-Allow-Origin", "https://tmr-tradinglanka.pages.dev");\n\
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");\n\
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");\n\
  res.header("Access-Control-Allow-Credentials", "true");\n\
  \n\
  // Respond immediately to OPTIONS requests\n\
  if (req.method === "OPTIONS") {\n\
    return res.status(200).end();\n\
  }\n\
  \n\
  next();\n\
});\n\
\n\
// Standard middleware\n\
app.use(express.json());\n\
app.use(express.urlencoded({ extended: true }));\n\
\n\
// Logging\n\
if (process.env.NODE_ENV !== "test") {\n\
  app.use(morgan("tiny"));\n\
}\n\
\n\
// PDF generation service\n\
const pdfService = require("./services/pdfService");\n\
\n\
// API Routes\n\
\n\
// Root route\n\
app.get("/", (req, res) => {\n\
  res.json({ message: "Bill Generator API" });\n\
});\n\
\n\
// Get all bills\n\
app.get("/api/bills", async (req, res) => {\n\
  try {\n\
    const bills = await Bill.find().sort({ createdAt: -1 });\n\
    res.status(200).json(bills);\n\
  } catch (error) {\n\
    logger.error(`Error fetching bills: ${error.message}`);\n\
    res.status(500).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Get single bill by ID\n\
app.get("/api/bills/:id", async (req, res) => {\n\
  try {\n\
    const bill = await Bill.findById(req.params.id);\n\
    if (!bill) {\n\
      return res.status(404).json({ error: "Bill not found" });\n\
    }\n\
    res.status(200).json(bill);\n\
  } catch (error) {\n\
    logger.error(`Error fetching bill: ${error.message}`);\n\
    res.status(500).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Generate PDF for bill\n\
app.get("/api/bills/:id/pdf", async (req, res) => {\n\
  try {\n\
    const bill = await Bill.findById(req.params.id);\n\
    if (!bill) {\n\
      return res.status(404).json({ error: "Bill not found" });\n\
    }\n\
    \n\
    // Generate PDF\n\
    const pdfBuffer = await pdfService.generatePDF(bill);\n\
    \n\
    // Set headers and send PDF\n\
    res.setHeader("Content-Type", "application/pdf");\n\
    res.setHeader("Content-Disposition", `attachment; filename=bill-${bill.billNumber || bill._id}.pdf`);\n\
    res.send(pdfBuffer);\n\
  } catch (error) {\n\
    logger.error(`Error generating PDF: ${error.message}`);\n\
    res.status(500).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Get all bike models\n\
app.get("/api/bike-models", async (req, res) => {\n\
  try {\n\
    const bikeModels = await BikeModel.find();\n\
    logger.info(`Found ${bikeModels.length} bike models:`);\n\
    res.status(200).json(bikeModels);\n\
  } catch (error) {\n\
    logger.error(`Error fetching bike models: ${error.message}`);\n\
    res.status(500).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Create new bike model\n\
app.post("/api/bike-models", async (req, res) => {\n\
  try {\n\
    const newBikeModel = new BikeModel(req.body);\n\
    const savedBikeModel = await newBikeModel.save();\n\
    res.status(201).json(savedBikeModel);\n\
  } catch (error) {\n\
    logger.error(`Error creating bike model: ${error.message}`);\n\
    res.status(400).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Create new bill\n\
app.post("/api/bills", async (req, res) => {\n\
  try {\n\
    let billData = req.body;\n\
    \n\
    // Generate bill number if not provided\n\
    if (!billData.billNumber && !billData.bill_number) {\n\
      const today = new Date();\n\
      const year = today.getFullYear().toString().substr(-2);\n\
      const month = (today.getMonth() + 1).toString().padStart(2, "0");\n\
      \n\
      // Get counter\n\
      const count = await Bill.countDocuments();\n\
      const billNumber = `TMR-${year}-${month}-${(count + 1).toString().padStart(4, "0")}`;\n\
      \n\
      billData.billNumber = billNumber;\n\
      billData.bill_number = billNumber;\n\
    }\n\
    \n\
    // Determine if bike is e-bicycle\n\
    const isEbicycle = billData.is_ebicycle || \n\
                      billData.model_name?.includes("COLA5") || \n\
                      billData.model_name?.includes("X01");\n\
    \n\
    // Set bike price\n\
    const bikePrice = Number(billData.bike_price || billData.price || billData.subtotal || 0);\n\
    \n\
    // Calculate RMV/CPZ charges\n\
    const rmvCharge = isEbicycle ? 0 : 13000;\n\
    const cpzCharge = isEbicycle ? 0 : 13500;\n\
    \n\
    // Handle different bill types\n\
    if (billData.bill_type === "leasing") {\n\
      // For leasing, total is down payment\n\
      const downPayment = Number(billData.down_payment || 0);\n\
      \n\
      billData = {\n\
        ...billData,\n\
        is_ebicycle: isEbicycle,\n\
        bike_price: bikePrice,\n\
        cpz_charge: cpzCharge,\n\
        down_payment: downPayment,\n\
        subtotal: bikePrice,\n\
        total: downPayment, // For leasing, total is the down payment\n\
        customerPhone: billData.customer_phone || billData.customer_nic || "",\n\
        customerName: billData.customer_name || billData.customerName || "",\n\
        isPaid: false,\n\
        status: "leasing",\n\
        paymentMethod: "leasing"\n\
      };\n\
      \n\
    } else if (billData.advance && Number(billData.advance) > 0) {\n\
      // For advance payment\n\
      const advanceAmount = Number(billData.advance || 0);\n\
      let fullAmount = bikePrice;\n\
      \n\
      if (billData.bill_type === "leasing") {\n\
        // For leasing advance, total is down payment\n\
        const downPayment = Number(billData.down_payment || 0);\n\
        fullAmount = downPayment;\n\
        billData.cpz_charge = cpzCharge;\n\
      } else {\n\
        // For cash advance, total is bike price + RMV\n\
        fullAmount = bikePrice + rmvCharge;\n\
        billData.rmv_charge = rmvCharge;\n\
      }\n\
      \n\
      // Calculate balance\n\
      const balance = fullAmount - advanceAmount;\n\
      \n\
      billData = {\n\
        ...billData,\n\
        is_ebicycle: isEbicycle,\n\
        bike_price: bikePrice,\n\
        advance: advanceAmount,\n\
        subtotal: bikePrice,\n\
        total: fullAmount,\n\
        balance: balance,\n\
        customerPhone: billData.customer_phone || billData.customer_nic || "",\n\
        customerName: billData.customer_name || billData.customerName || "",\n\
        isPaid: false,\n\
        status: "pending"\n\
      };\n\
      \n\
    } else {\n\
      // Regular cash bill\n\
      const totalAmount = bikePrice + (isEbicycle ? 0 : rmvCharge);\n\
      \n\
      billData = {\n\
        ...billData,\n\
        is_ebicycle: isEbicycle,\n\
        bike_price: bikePrice,\n\
        rmv_charge: rmvCharge,\n\
        subtotal: bikePrice,\n\
        total: totalAmount,\n\
        customerPhone: billData.customer_phone || billData.customer_nic || "",\n\
        customerName: billData.customer_name || billData.customerName || "",\n\
        isPaid: billData.bill_type === "cash",\n\
        status: billData.bill_type === "cash" ? "paid" : "pending",\n\
        paymentMethod: billData.bill_type === "cash" ? "cash" : billData.paymentMethod || "pending"\n\
      };\n\
    }\n\
    \n\
    // Get bike model details if not provided\n\
    if (billData.model_name && !billData.bike_price) {\n\
      try {\n\
        const bikeModel = await BikeModel.findOne({ \n\
          $or: [\n\
            { name: billData.model_name },\n\
            { model_name: billData.model_name }\n\
          ]\n\
        });\n\
        if (bikeModel) {\n\
          billData.bike_price = bikeModel.price;\n\
          billData.is_ebicycle = bikeModel.is_ebicycle;\n\
          \n\
          // Recalculate total\n\
          if (billData.bill_type === "leasing") {\n\
            // No changes needed, total is already set to down payment\n\
          } else if (billData.advance && Number(billData.advance) > 0) {\n\
            if (billData.bill_type === "leasing") {\n\
              // Balance calculation already handled\n\
            } else {\n\
              // Cash with advance\n\
              const rmvCharge = billData.is_ebicycle ? 0 : 13000;\n\
              billData.total = billData.bike_price + rmvCharge;\n\
              billData.balance = billData.total - billData.advance;\n\
            }\n\
          } else {\n\
            // Regular cash bill\n\
            const rmvCharge = billData.is_ebicycle ? 0 : 13000;\n\
            billData.total = billData.bike_price + rmvCharge;\n\
          }\n\
        }\n\
      } catch (error) {\n\
        logger.error(`Error fetching bike model: ${error.message}`);\n\
      }\n\
    }\n\
    \n\
    const newBill = new Bill(billData);\n\
    const savedBill = await newBill.save();\n\
    res.status(201).json(savedBill);\n\
  } catch (error) {\n\
    logger.error(`Error creating bill: ${error.message}`);\n\
    res.status(400).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Update bill\n\
app.put("/api/bills/:id", async (req, res) => {\n\
  try {\n\
    let updateData = req.body;\n\
    \n\
    // Determine if bike is e-bicycle\n\
    const isEbicycle = updateData.is_ebicycle || \n\
                      updateData.model_name?.includes("COLA5") || \n\
                      updateData.model_name?.includes("X01");\n\
    \n\
    // Set bike price\n\
    const bikePrice = Number(updateData.bike_price || updateData.price || updateData.subtotal || 0);\n\
    \n\
    // Handle field compatibility and business logic\n\
    if (updateData.bill_type === "leasing") {\n\
      // For leasing updates\n\
      updateData.is_ebicycle = isEbicycle;\n\
      updateData.bike_price = bikePrice;\n\
      updateData.cpz_charge = isEbicycle ? 0 : 13500;\n\
      updateData.down_payment = Number(updateData.down_payment || 0);\n\
      updateData.total = updateData.down_payment; // For leasing, total is down payment\n\
      updateData.status = "leasing";\n\
      updateData.isPaid = false;\n\
      updateData.paid = false;\n\
    } else if (updateData.advance && Number(updateData.advance) > 0) {\n\
      // For advance payment updates\n\
      updateData.is_ebicycle = isEbicycle;\n\
      updateData.bike_price = bikePrice;\n\
      \n\
      if (updateData.bill_type === "leasing") {\n\
        updateData.cpz_charge = isEbicycle ? 0 : 13500;\n\
        updateData.down_payment = Number(updateData.down_payment || 0);\n\
        updateData.total = updateData.down_payment;\n\
        updateData.balance = updateData.down_payment - Number(updateData.advance);\n\
      } else {\n\
        updateData.rmv_charge = isEbicycle ? 0 : 13000;\n\
        updateData.total = bikePrice + updateData.rmv_charge;\n\
        updateData.balance = updateData.total - Number(updateData.advance);\n\
      }\n\
    } else if (updateData.items && Array.isArray(updateData.items)) {\n\
      // If updating items, calculate totals\n\
      const subtotal = updateData.items.reduce(\n\
        (sum, item) => sum + Number(item.amount || item.total || 0),\n\
        0\n\
      );\n\
      updateData.subtotal = subtotal;\n\
      updateData.subTotal = subtotal; // For compatibility\n\
      updateData.total = subtotal + Number(updateData.tax || 0);\n\
      updateData.amount = updateData.total; // For compatibility\n\
    } else {\n\
      // Regular cash bill updates\n\
      updateData.is_ebicycle = isEbicycle;\n\
      updateData.bike_price = bikePrice;\n\
      updateData.rmv_charge = isEbicycle ? 0 : 13000;\n\
      updateData.total = bikePrice + updateData.rmv_charge;\n\
    }\n\
    \n\
    // Handle compatibility between field formats\n\
    if (updateData.customer_name && !updateData.customerName) {\n\
      updateData.customerName = updateData.customer_name;\n\
    }\n\
    if (updateData.customer_phone && !updateData.customerPhone) {\n\
      updateData.customerPhone = updateData.customer_phone;\n\
    }\n\
    \n\
    const updatedBill = await Bill.findByIdAndUpdate(\n\
      req.params.id,\n\
      updateData,\n\
      { new: true, runValidators: true }\n\
    );\n\
    \n\
    if (!updatedBill) {\n\
      return res.status(404).json({ error: "Bill not found" });\n\
    }\n\
    \n\
    res.status(200).json(updatedBill);\n\
  } catch (error) {\n\
    logger.error(`Error updating bill: ${error.message}`);\n\
    res.status(400).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Update bill status\n\
app.patch("/api/bills/:id/status", async (req, res) => {\n\
  try {\n\
    const { status } = req.body;\n\
    if (!status) {\n\
      return res.status(400).json({ error: "Status is required" });\n\
    }\n\
    \n\
    // Handle different status types\n\
    let updateData = { status };\n\
    \n\
    if (status === "paid") {\n\
      updateData.isPaid = true;\n\
      updateData.paid = true;\n\
      updateData.paymentMethod = req.body.paymentMethod || "cash";\n\
    } else if (status === "cancelled") {\n\
      updateData.isPaid = false;\n\
      updateData.paid = false;\n\
    }\n\
    \n\
    const updatedBill = await Bill.findByIdAndUpdate(\n\
      req.params.id,\n\
      updateData,\n\
      { new: true }\n\
    );\n\
    \n\
    if (!updatedBill) {\n\
      return res.status(404).json({ error: "Bill not found" });\n\
    }\n\
    \n\
    res.status(200).json(updatedBill);\n\
  } catch (error) {\n\
    logger.error(`Error updating bill status: ${error.message}`);\n\
    res.status(400).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Convert bill to leasing\n\
app.put("/api/bills/:id/convert-to-leasing", async (req, res) => {\n\
  try {\n\
    // Get current bill to check if it is e-bicycle\n\
    const currentBill = await Bill.findById(req.params.id);\n\
    if (!currentBill) {\n\
      return res.status(404).json({ error: "Bill not found" });\n\
    }\n\
    \n\
    // Check if model is e-bicycle\n\
    const isEbicycle = currentBill.is_ebicycle || \n\
                      currentBill.model_name?.includes("COLA5") || \n\
                      currentBill.model_name?.includes("X01");\n\
    \n\
    // Dont allow leasing for e-bicycles\n\
    if (isEbicycle) {\n\
      return res.status(400).json({ error: "E-bicycles cannot be converted to leasing" });\n\
    }\n\
    \n\
    const bikePrice = Number(currentBill.bike_price || currentBill.subtotal || 0);\n\
    const cpzCharge = 13500; // For leasing\n\
    const downPayment = Number(req.body.down_payment || 0);\n\
    \n\
    const updateData = {\n\
      ...req.body,\n\
      status: "leasing",\n\
      bill_type: "leasing",\n\
      paymentMethod: "leasing",\n\
      isPaid: false,\n\
      paid: false,\n\
      is_ebicycle: false,\n\
      bike_price: bikePrice,\n\
      cpz_charge: cpzCharge,\n\
      down_payment: downPayment,\n\
      total: downPayment, // For leasing, total is down payment\n\
      // If there is an advance payment\n\
      balance: req.body.advance ? (downPayment - Number(req.body.advance)) : null\n\
    };\n\
    \n\
    const updatedBill = await Bill.findByIdAndUpdate(\n\
      req.params.id,\n\
      updateData,\n\
      { new: true, runValidators: true }\n\
    );\n\
    \n\
    res.status(200).json(updatedBill);\n\
  } catch (error) {\n\
    logger.error(`Error converting bill to leasing: ${error.message}`);\n\
    res.status(400).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Delete bill\n\
app.delete("/api/bills/:id", async (req, res) => {\n\
  try {\n\
    const bill = await Bill.findByIdAndDelete(req.params.id);\n\
    if (!bill) {\n\
      return res.status(404).json({ error: "Bill not found" });\n\
    }\n\
    res.status(200).json({ message: "Bill deleted successfully" });\n\
  } catch (error) {\n\
    logger.error(`Error deleting bill: ${error.message}`);\n\
    res.status(500).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Mark bill as paid\n\
app.patch("/api/bills/:id/pay", async (req, res) => {\n\
  try {\n\
    const { paymentMethod } = req.body;\n\
    if (!paymentMethod) {\n\
      return res.status(400).json({ error: "Payment method is required" });\n\
    }\n\
    \n\
    const updatedBill = await Bill.findByIdAndUpdate(\n\
      req.params.id,\n\
      { \n\
        isPaid: true,\n\
        paid: true,\n\
        status: "paid",\n\
        paymentMethod,\n\
        bill_type: paymentMethod\n\
      },\n\
      { new: true }\n\
    );\n\
    \n\
    if (!updatedBill) {\n\
      return res.status(404).json({ error: "Bill not found" });\n\
    }\n\
    \n\
    res.status(200).json(updatedBill);\n\
  } catch (error) {\n\
    logger.error(`Error marking bill as paid: ${error.message}`);\n\
    res.status(400).json({ error: error.message });\n\
  }\n\
});\n\
\n\
// Start server\n\
const server = app.listen(port, async () => {\n\
  try {\n\
    // Connect to database\n\
    await connectToDatabase();\n\
    logger.info(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${port}`);\n\
  } catch (error) {\n\
    logger.error(`Failed to start server: ${error.message}`);\n\
    setTimeout(() => {\n\
      process.exit(1);\n\
    }, 1000);\n\
  }\n\
});\n\
\n\
// Graceful shutdown\n\
process.on("SIGTERM", () => {\n\
  logger.info("SIGTERM signal received");\n\
  server.close(() => {\n\
    logger.info("HTTP server closed");\n\
    mongoose.connection.close();\n\
    process.exit(0);\n\
  });\n\
});\n\
\n\
process.on("SIGINT", () => {\n\
  logger.info("SIGINT signal received");\n\
  server.close(() => {\n\
    logger.info("HTTP server closed");\n\
    mongoose.connection.close();\n\
    process.exit(0);\n\
  });\n\
});\n\
\n\
module.exports = app;' > src/server.js

# Create .env file
RUN printf "%s" 'PORT=8080\n\
NODE_ENV=production\n\
MONGODB_URI=mongodb://localhost:27017/tmr\n\
CORS_ORIGIN=https://tmr-tradinglanka.pages.dev,https://web-production-0ed6.up.railway.app' > .env

# Create a smaller production image
# Using the same Node.js 22 bookworm-slim variant for the final image
FROM node:22-bookworm-slim

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Create a non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.env ./.env

# Set proper permissions
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port the app runs on
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start the application
CMD ["node", "src/server.js"]