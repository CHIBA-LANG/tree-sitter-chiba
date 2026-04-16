/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Chiba Tree-sitter Grammar
// Based on CHIBA-SPEC/LANG/{lexical,syntax}.md

const PREC = {
  LAMBDA: -2,
  EXPR_STMT: -1,
  DEFAULT: 0,
  OR: 1,
  AND: 2,
  COMPARE: 3,
  ADD: 4,
  MUL: 5,
  UNARY: 6,
  CAST: 7,
  POSTFIX: 8,
};

module.exports = grammar({
  name: "chiba",

  extras: ($) => [/\s/, $.line_comment],

  word: ($) => $.identifier,

  conflicts: ($) => [
    // record literal: `Ident { field: val }` vs variable followed by block
    [$.record_literal, $.variable],
    // use paths: single vs glob/multi share prefix
    [$.use_single, $.use_multi, $.use_glob],
  ],

  supertypes: ($) => [$.expression, $.statement, $.pattern, $.type],

  rules: {
    // ── Top-level ─────────────────────────────────────
    source_file: ($) =>
      seq(
        repeat($.file_attribute),
        optional($.namespace_decl),
        repeat($.use_decl),
        repeat($.item)
      ),

    // #![Metal]  #![CBI]
    file_attribute: ($) =>
      seq("#!", "[", $.identifier, "]"),

    // namespace runtime.alloc
    namespace_decl: ($) =>
      seq("namespace", $.dotted_identifier),

    // use std.io / use a.b.{c, d} / use a.b.*
    use_decl: ($) =>
      seq(
        "use",
        choice(
          $.use_glob,
          $.use_multi,
          $.use_single
        )
      ),

    // use_prefix captures "a.b.c." — one or more "ident." segments
    _use_prefix: ($) => repeat1(seq($.identifier, ".")),

    use_single: ($) => prec.left(sep1($.identifier, ".")),
    use_multi: ($) =>
      seq($._use_prefix, "{", commaSep1($.identifier), "}"),
    use_glob: ($) =>
      seq($._use_prefix, "*"),

    dotted_identifier: ($) =>
      prec.left(sep1($.identifier, ".")),

    // ── Items ─────────────────────────────────────────
    item: ($) =>
      seq(
        repeat($.item_attribute),
        optional("private"),
        choice(
          $.type_def,
          $.data_def,
          $.union_def,
          $.fun_def,
          $.extern_decl
        )
      ),

    // #[entry]
    item_attribute: ($) =>
      seq("#[", $.identifier, "]"),

    // type Buffer { ptr: *u8, len: usize }  /  type Pair[A, B] { fst: A, snd: B }
    type_def: ($) =>
      seq("type", field("name", $.identifier), optional($.type_parameters), "{", repeat($.field_decl), "}"),

    field_decl: ($) =>
      seq(field("name", $.identifier), ":", field("type", $.type)),

    // data List { Nil, Cons(i64, List) }  /  data Option[T] { None, Some(T) }
    data_def: ($) =>
      seq(
        "data",
        field("name", $.identifier),
        optional($.type_parameters),
        "{",
        commaSep1($.variant),
        optional(","),
        "}"
      ),

    variant: ($) =>
      choice($.variant_nullary, $.variant_tuple),

    variant_nullary: ($) => field("name", $.identifier),

    variant_tuple: ($) =>
      seq(
        field("name", $.identifier),
        "(",
        commaSep1($.type),
        ")"
      ),

    // union Value { i: i64, p: *u8 }
    union_def: ($) =>
      seq("union", field("name", $.identifier), optional($.type_parameters), "{", repeat($.field_decl), "}"),

    // def add(x: i64, y: i64): i64 = x + y
    // def id[T](x: T): T = x
    fun_def: ($) =>
      seq(
        "def",
        field("name", $.identifier),
        optional($.type_parameters),
        "(",
        commaSep($.parameter),
        ")",
        ":",
        field("return_type", $.type),
        "=",
        field("body", $.expression)
      ),

    // def malloc(size: usize): *u8 = extern "c" "malloc"
    extern_decl: ($) =>
      seq(
        "def",
        field("name", $.identifier),
        optional($.type_parameters),
        "(",
        commaSep($.parameter),
        ")",
        ":",
        field("return_type", $.type),
        "=",
        "extern",
        field("convention", $.string_literal),
        field("symbol", $.string_literal)
      ),

    // [T]  [T, U]  [T: Show]
    type_parameters: ($) =>
      seq("[", commaSep1($.identifier), "]"),

    parameter: ($) =>
      seq(field("name", $.identifier), ":", field("type", $.type)),

    // ── Types ─────────────────────────────────────────
    type: ($) =>
      choice(
        $.pointer_type,
        $.function_type,
        $.tuple_type,
        $.generic_type,
        $.named_type
      ),

    pointer_type: ($) => prec(2, seq("*", $.type)),

    function_type: ($) =>
      prec.right(1, seq(
        "(",
        commaSep($.type),
        ")",
        "=>",
        $.type
      )),

    tuple_type: ($) =>
      seq("(", $.type, repeat1(seq(",", $.type)), ")"),

    // Option[T]  List[(Str, Ty)]  Map[K, V]
    generic_type: ($) =>
      prec(1, seq(
        field("name", $.identifier),
        "[",
        commaSep1($.type),
        "]"
      )),

    named_type: ($) => $.identifier,

    // ── Statements ────────────────────────────────────
    block: ($) =>
      seq(
        "{",
        repeat($.statement),
        optional(field("return", $.expression)),
        "}"
      ),

    statement: ($) =>
      choice($.let_statement, $.expression_statement),

    let_statement: ($) =>
      seq(
        "let",
        field("pattern", $.pattern),
        optional(seq(":", field("type_annotation", $.type))),
        "=",
        field("value", $.expression)
      ),

    expression_statement: ($) =>
      prec(PREC.EXPR_STMT, $.expression),

    // ── Patterns ──────────────────────────────────────
    pattern: ($) =>
      choice(
        $.wildcard_pattern,
        $.constructor_pattern,
        $.tuple_pattern,
        $.integer_literal,
        $.boolean_literal,
        $.pattern_identifier
      ),

    wildcard_pattern: (_$) => "_",

    pattern_identifier: ($) => $.identifier,

    constructor_pattern: ($) =>
      prec(2, seq(
        field("constructor", $.identifier),
        "(",
        commaSep1($.pattern),
        ")"
      )),

    tuple_pattern: ($) =>
      seq("(", $.pattern, repeat1(seq(",", $.pattern)), ")"),

    // ── Expressions ───────────────────────────────────
    expression: ($) =>
      choice(
        $.binary_expression,
        $.unary_expression,
        $.cast_expression,
        $.call_expression,
        $.field_expression,
        $.index_expression,
        $._primary_expression
      ),

    _primary_expression: ($) =>
      choice(
        $.if_expression,
        $.if_let_expression,
        $.match_expression,
        $.block,
        $.lambda_expression,
        $.reset_expression,
        $.shift_expression,
        $.unsafe_expression,
        $.asm_expression,
        $.record_literal,
        $.record_update,
        $.tuple_literal,
        $.integer_literal,
        $.string_literal,
        $.boolean_literal,
        $.unit_literal,
        $.symbol_literal,
        $.variable,
        $.parenthesized_expression
      ),

    parenthesized_expression: ($) =>
      seq("(", $.expression, ")"),

    // Binary ops with precedence
    binary_expression: ($) =>
      choice(
        ...[
          ["||", PREC.OR],
          ["&&", PREC.AND],
          ["==", PREC.COMPARE],
          ["!=", PREC.COMPARE],
          ["<", PREC.COMPARE],
          ["<=", PREC.COMPARE],
          [">", PREC.COMPARE],
          [">=", PREC.COMPARE],
          ["+", PREC.ADD],
          ["-", PREC.ADD],
          ["*", PREC.MUL],
          ["/", PREC.MUL],
          ["%", PREC.MUL],
        ].map(([op, prec_val]) =>
          prec.left(
            /** @type {number} */ (prec_val),
            seq(
              field("left", $.expression),
              field("operator", /** @type {string} */ (op)),
              field("right", $.expression)
            )
          )
        )
      ),

    unary_expression: ($) =>
      prec(PREC.UNARY, seq(
        field("operator", choice("-", "!", "*")),
        field("operand", $.expression)
      )),

    call_expression: ($) =>
      prec(PREC.POSTFIX, seq(
        field("function", $.expression),
        "(",
        commaSep($.expression),
        ")"
      )),

    field_expression: ($) =>
      prec.left(PREC.POSTFIX, seq(
        field("base", $.expression),
        ".",
        field("field", $.identifier)
      )),

    index_expression: ($) =>
      prec(PREC.POSTFIX, seq(
        field("base", $.expression),
        "[",
        field("index", $.expression),
        "]"
      )),

    cast_expression: ($) =>
      prec(PREC.CAST, seq(
        field("value", $.expression),
        "as",
        field("type", $.type)
      )),

    // if cond { a } else { b }
    // if cond { a } else if cond2 { b } else { c }
    if_expression: ($) =>
      prec.right(seq(
        "if",
        field("condition", $.expression),
        field("then", $.block),
        "else",
        field("else", choice($.block, $.if_expression, $.if_let_expression))
      )),

    // if let Pat = expr { ... } else { ... }
    if_let_expression: ($) =>
      prec.right(seq(
        "if",
        "let",
        field("pattern", $.pattern),
        "=",
        field("value", $.expression),
        field("then", $.block),
        "else",
        field("else", choice($.block, $.if_expression, $.if_let_expression))
      )),

    // match expr { Pat => body ... }
    match_expression: ($) =>
      seq(
        "match",
        field("scrutinee", $.expression),
        "{",
        repeat($.match_arm),
        "}"
      ),

    match_arm: ($) =>
      seq(
        field("pattern", $.pattern),
        "=>",
        field("body", $.expression)
      ),

    // (x: i64, y: i64): i64 => body
    // (x: i64, y: i64) => body          (return type optional)
    lambda_expression: ($) =>
      prec(PREC.LAMBDA, seq(
        "(",
        commaSep($.parameter),
        ")",
        optional(seq(":", field("return_type", $.type))),
        "=>",
        field("body", $.expression)
      )),

    // reset :tag { body }
    reset_expression: ($) =>
      prec.right(seq(
        "reset",
        optional(field("tag", $._reset_shift_tag)),
        field("body", $.block)
      )),

    // shift :tag k { body }
    shift_expression: ($) =>
      prec.right(seq(
        "shift",
        optional(field("tag", $._reset_shift_tag)),
        field("continuation", $.identifier),
        field("body", $.block)
      )),

    // Tags for reset/shift are typically symbol literals or int literals
    _reset_shift_tag: ($) =>
      choice(
        $.symbol_literal,
        $.integer_literal
      ),

    // unsafe { ... }
    unsafe_expression: ($) =>
      seq("unsafe", $.block),

    // asm (inputs) : (outputs) => { instrs }
    asm_expression: ($) =>
      seq(
        "asm",
        "(",
        commaSep($.asm_input),
        ")",
        optional(seq(":", "(", commaSep($.asm_output), ")")),
        "=>",
        "{",
        repeat($.string_literal),
        "}"
      ),

    asm_input: ($) =>
      seq(field("value", $.expression), ":", field("register", $.identifier)),

    asm_output: ($) => $.identifier,

    // Record { field: val }
    record_literal: ($) =>
      prec.dynamic(1, seq(
        field("type_name", $.identifier),
        "{",
        commaSep1($.record_field_value),
        "}"
      )),

    record_field_value: ($) =>
      seq(
        field("name", $.identifier),
        ":",
        field("value", $.expression)
      ),

    // { base | field: val }
    record_update: ($) =>
      seq(
        "{",
        field("base", $.expression),
        "|",
        commaSep1($.record_field_value),
        "}"
      ),

    // (a, b, c)
    tuple_literal: ($) =>
      prec(1, seq(
        "(",
        $.expression,
        repeat1(seq(",", $.expression)),
        ")"
      )),

    // ── Literals & atoms ──────────────────────────────
    integer_literal: (_$) =>
      token(choice(
        /0[xX][0-9a-fA-F]+/,
        /[0-9]+/
      )),

    string_literal: (_$) =>
      token(seq(
        '"',
        repeat(choice(
          /[^"\\]/,
          /\\[\\ntr0"]/
        )),
        '"'
      )),

    boolean_literal: (_$) => choice("true", "false"),

    unit_literal: (_$) => seq("(", ")"),

    // :tag
    symbol_literal: (_$) =>
      token(seq(":", /[a-zA-Z_][a-zA-Z0-9_]*/)),

    variable: ($) => $.identifier,

    // ── Basics ────────────────────────────────────────
    identifier: (_$) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    line_comment: (_$) => token(seq("//", /.*/)),
  },
});

/**
 * @param {RuleOrLiteral} rule
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * @param {RuleOrLiteral} rule
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

/**
 * @param {RuleOrLiteral} rule
 * @param {RuleOrLiteral} separator
 */
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
