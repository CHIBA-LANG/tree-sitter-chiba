; Chiba highlights.scm
; Tree-sitter highlight queries for Neovim / Zed / Emacs / VS Code

; ── Keywords ────────────────────────────────────────────
[
  "def"
  "let"
  "type"
  "data"
  "union"
  "if"
  "else"
  "match"
  "extern"
  "unsafe"
  "reset"
  "shift"
  "as"
  "use"
  "namespace"
  "private"
  "asm"
] @keyword

; ── Operators ───────────────────────────────────────────
(binary_expression operator: _ @operator)
(unary_expression operator: _ @operator)
"=>" @operator
"=" @operator
"|" @operator

; ── Punctuation ─────────────────────────────────────────
["(" ")" "{" "}" "[" "]"] @punctuation.bracket
["," "." ":"] @punctuation.delimiter
["#!" "#["] @punctuation.special

; ── Functions ───────────────────────────────────────────
(fun_def name: (identifier) @function)
(extern_decl name: (identifier) @function)
(call_expression function: (variable (identifier) @function.call))
(parameter name: (identifier) @variable.parameter)

; ── Types ───────────────────────────────────────────────
(type_def name: (identifier) @type)
(data_def name: (identifier) @type)
(union_def name: (identifier) @type)
(named_type (identifier) @type)
(pointer_type "*" @type)
(field_decl name: (identifier) @property)
(record_field_value name: (identifier) @property)

; ── Variants / Constructors ─────────────────────────────
(variant_nullary name: (identifier) @constructor)
(variant_tuple name: (identifier) @constructor)
(constructor_pattern constructor: (identifier) @constructor)

; ── Literals ────────────────────────────────────────────
(integer_literal) @number
(string_literal) @string
(boolean_literal) @boolean
(unit_literal) @constant.builtin
(symbol_literal) @string.special.symbol

; ── Variables ───────────────────────────────────────────
(variable (identifier) @variable)
(pattern_identifier (identifier) @variable)
(wildcard_pattern) @variable.builtin

; ── Namespace / Imports ─────────────────────────────────
(namespace_decl (dotted_identifier (identifier) @module))
(use_decl (use_single (identifier) @module))
(use_decl (use_multi (identifier) @module))
(use_decl (use_glob (identifier) @module))

; ── Attributes ──────────────────────────────────────────
(file_attribute (identifier) @attribute)
(item_attribute (identifier) @attribute)

; ── Generics ────────────────────────────────────────────
(type_parameters (identifier) @type)
(generic_type name: (identifier) @type)

; ── Field access ────────────────────────────────────────
(field_expression field: (identifier) @property)

; ── Record literal type name ────────────────────────────
(record_literal type_name: (identifier) @type)

; ── Match arm ───────────────────────────────────────────
(match_arm pattern: (pattern_identifier (identifier) @variable))

; ── Continuation variable in shift ──────────────────────
(shift_expression continuation: (identifier) @variable.parameter)

; ── ASM registers ───────────────────────────────────────
(asm_input register: (identifier) @variable.builtin)
(asm_output (identifier) @variable.builtin)

; ── Extern strings ──────────────────────────────────────
(extern_decl convention: (string_literal) @string.special)
(extern_decl symbol: (string_literal) @string.special)

; ── Comments ────────────────────────────────────────────
(line_comment) @comment
