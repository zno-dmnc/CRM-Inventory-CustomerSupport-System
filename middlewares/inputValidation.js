const { body, validationResult } = require('express-validator');

const validateLoginInput = [
    body('email').notEmpty().withMessage('email is required'),
    body('password').notEmpty().withMessage('Password is required'),
];

const validateUserProfileInput = [
    body('name').notEmpty().withMessage('Name is required').trim().escape(),
    body('phone').notEmpty().withMessage('Phone is required').trim().escape(),
    body('address').notEmpty().withMessage('Address is required').trim().escape(),
    body('user_type').isIn(['admin', 'customer', "supplier", "agent"]).withMessage('User role must be either "admin", "customer", or "supplier".').trim().escape(),
    body('email').notEmpty().withMessage('Email is required').isEmail().withMessage('Invalid email address').trim().escape(),
    body('password').notEmpty().withMessage('Password is required').trim().escape(),
    
];

const validateUserProfileEdit = [
    body('name').optional().trim().escape(),
    body('phone').optional().trim().escape(),
    body('address').optional().trim().escape(),
    body('email').optional().isEmail().withMessage('Invalid email address').trim().escape(),
    body('password').optional().trim().escape(),
    // Custom validation to ensure at least one field is provided
    body().custom((value, { req }) => {
        const fields = ['name', 'phone', 'address', 'user_type', 'email', 'password'];
        const isAnyFieldProvided = fields.some(field => req.body[field]);
        if (!isAnyFieldProvided) {
            throw new Error('At least one field must be provided for update.');
        }
        return true;
    }),
];

const validateProductInput = [
    body('name').notEmpty().withMessage('Product name is required').trim().escape(),
    body('description').notEmpty().withMessage('Product description is required').trim().escape(),
    body('price').notEmpty().withMessage('Product Price is required')
        .isFloat({ min: 1 }).withMessage('Product price must be a valid float greater than or equal to 1')
];

const validateProductEditInput = [
    body('price').optional().trim().escape()
        .isFloat().withMessage('Product price must be an integer'),
    body('name').optional().isEmail().trim().escape(),
    body('description').optional().trim().escape(),
    // Custom validation to ensure at least one field is provided
    body().custom((value, { req }) => {
        const fields = ['name', 'phone', 'price', 'description'];
        const isAnyFieldProvided = fields.some(field => req.body[field]);
        if (!isAnyFieldProvided) {
            throw new Error('At least one field must be provided for update.');
        }
        return true;
    }),
];

const validateNewOrdersInput = [
    body('supplier_id').notEmpty().withMessage('Supplier ID is required').trim().escape(),
    body('product_id').notEmpty().withMessage('Product ID is required').trim().escape(),
    body('order_quantity').notEmpty().withMessage('Product Quantity is required').trim().escape().isInt().withMessage('Quantity should be a number')
    .custom(value => {
        if (value <= 0) {
            throw new Error('Quantity must be greater than 0');
        }
        return true;
    }),
];

const validateEditOrdersInput = [
    body('order_quantity').optional().isInt().withMessage('Product quantity must be an integer').trim().escape(),   
    body('supplier_id').optional(),
    body('product_id').optional(),
    body().custom((value, { req }) => {
        const fields = ['supplier_id', 'product_id', 'order_quantity'];
        const isAnyFieldProvided = fields.some(field => req.body[field]);
        if (!isAnyFieldProvided) {
            throw new Error('At least one field must be provided for update.');
        }
        return true;
    }),

];


const validateInventoryInput = [
    body('product_id').notEmpty().withMessage('Product ID is required').isInt().withMessage('Product ID must be an integer'),
    body('quantity')
        .notEmpty().withMessage('Quantity is required')
        .isInt().withMessage('Quantity must be an integer')
        .custom(value => {
            if (value <= 0) {
                throw new Error('Quantity must be greater than 0');
            }
            return true;
        }),
];

const validateInventoryEdit = [
    body('product_id').optional().isInt().withMessage('Product ID must be an integer'),
    body('quantity')
        .optional()
        .isInt().withMessage('Quantity must be an integer')
        .custom(value => {
            if (value <= 0) {
                throw new Error('Quantity must be greater than 0');
            }
            return true;
        }),
    body('minimum_quantity')
        .optional()
        .isInt().withMessage('Minimum quantity must be an integer')
        .custom((value, { req }) => {
            const quantity = req.body.quantity;
            if (quantity && value !== quantity * 0.05) {
                throw new Error('Minimum quantity must be 5% of the total quantity');
            }
            return true;
        }),

    body().custom((value, { req }) => {
        const fields = ['product_id', 'quantity', 'minimum_quantity'];
        const isAnyFieldProvided = fields.some(field => req.body[field]);
        if (!isAnyFieldProvided) {
            throw new Error('At least one field must be provided for update.');
        }
        return true;
    }),
]

const validateSaleInput = [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('product_id').notEmpty().withMessage('Product ID is required'),
    body('quantity').notEmpty().withMessage('Product quantity is required').trim().escape()
        .isInt().withMessage('Product quantity must be an integer')
        .custom(value => {
            if (value <= 0) {
                throw new Error('Quantity must be greater than 0');
            }
            return true;
        }),
]

const validateSaleEdit = [
    body('user_id').optional(),
    body('product_id').optional(),
    body('quantity').optional().isInt().withMessage('Product quantity must be an integer')
        .custom(value => {
            if (value <= 0) {
                throw new Error('Quantity must be greater than 0');
            }
            return true;
        }),

    body().custom((value, { req }) => {
        const fields = ['user_id', 'product_id', 'quantity'];
        const isAnyFieldProvided = fields.some(field => req.body[field]);
        if (!isAnyFieldProvided) {
            throw new Error('At least one field must be provided for update.');
        }
        return true;
    }),
]

const validateTicketInput = [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('subject').notEmpty().withMessage('Subject is required').trim().escape(),
    body('description').notEmpty().withMessage('Description is required').trim().escape(),
]

const validateTicketEdit = [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('support_id').notEmpty().withMessage('Support ID is required'),
    body('subject').optional(),
    body('description').optional(),
    body('priority').optional()
]

const validateTicketUpdate = [
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('support_id').notEmpty().withMessage('Support ID is required'),
    body('status').notEmpty().withMessage('Status is required'),
    body('priority').notEmpty().withMessage('Priority is needed'),
    body('subject').optional(),
    body('description').optional(),
]

const validateCommunicationInput = [
    body('ticket_id').notEmpty().withMessage('Ticket ID is required'),
    body('user_id').notEmpty().withMessage('User ID is required'),
    body('message').notEmpty().withMessage('Message is required').trim().escape()
]

const validateCommunicationEdit = [
    body('message').notEmpty().withMessage('Message is required').trim().escape()
]

const checkValidationResults = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }
    next();
};



module.exports = {
    validateLoginInput,
    validateUserProfileInput,
    validateUserProfileEdit,
    validateProductInput,
    validateProductEditInput,
    validateNewOrdersInput,
    validateEditOrdersInput,
    validateInventoryInput,
    validateInventoryEdit,
    validateSaleInput,
    validateSaleEdit,
    validateTicketInput,
    validateTicketEdit,
    validateTicketUpdate,
    validateCommunicationInput,
    validateCommunicationEdit,
    checkValidationResults,
};