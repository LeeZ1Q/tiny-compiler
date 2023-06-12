// TOKENIZER
function tokenizer(input) {
	//记录当前编译到的位置
	let current = 0;
	//存放token
	let tokens = [];

	//遍历input
	while (current < input.length) {
		const char = input[current];
		//定义词法规则

		//匹配左括号
		if (char === "(") {
			tokens.push({ type: "paren", value: "(" });
			current++;
			continue;
		}

		//匹配右括号
		if (char === ")") {
			tokens.push({ type: "paren", value: ")" });
			current++;
			continue;
		}

		// 匹配空格
		if (char === " ") {
			// 空格不被记录
			current++;
			continue;
		}

		// 匹配数字 使用正则表达式
		const NUMBERS = /[0-9]/;
		if (NUMBERS.test(char)) {
			// 数字不止一位，循环遍历数字
			// 用value字符串存放数字
			let value = "";
			while (NUMBERS.test(char)) {
				value += char;
				char = input[++current];
			}
			tokens.push({ type: "number", value });
			continue;
		}

		// 匹配字符串
		if (char === '"') {
			let value = "";
			// 跳过第一个双引号
			char = input[++current];
			while (char !== '"') {
				value += char;
				char = input[++current];
			}
			// 跳过第二个双引号
			char = input[++current];
			tokens.push({ type: "string", value });
			continue;
		}

		// 匹配函数名
		const LETTERS = /[a-z]/i;
		if (LETTERS.test(char)) {
			let value = "";
			while (LETTERS.test(char)) {
				value += char;
				char = input[++current];
			}
			tokens.push({ type: "name", value });
			continue;
		}

		// 未匹配到规则，抛出错误
		throw new TypeError("I dont know what this character is: " + char);
	}

	return tokens;
}

//PARSER
function parser(tokens) {
	let current = 0;

	//walk用于给每一个token生成AST
	function walk() {
		let token = tokens[current];

		//匹配number类型的token
		if (token.type === "number") {
			current++;
			return {
				type: "NumberLiteral",
				value: token.value,
			};
		}

		//匹配string类型的token
		if (token.type === "string") {
			current++;
			return {
				type: "StringLiteral",
				value: token.value,
			};
		}

		//匹配CallExpression类型的token
		//表达式以括号开始，接着是函数名，括以号结束
		if (token.type === "paren" && token.value === "(") {
			//跳过 (
			token = tokens[++current];

			//创建一个AST节点，类型为CallExpression
			let node = {
				type: "CallExpression",
				name: token.value,
				params: [],
			};

			token = tokens[++current]; //跳过函数名

			//循环遍历参数，直到遇到)
			while (
				token.type !== "paren" ||
				(token.type === "paren" && token.value !== ")")
			) {
				node.params.push(walk());
				token = tokens[current]; //开始递归，更新token
			}

			current++; //跳过)

			return node;
		}

		//抛出错误
		throw new TypeError(token.type);
	}

	//AST的根节点
	let ast = {
		type: "Program",
		body: [],
	};

	//遍历tokens，循环生成AST
	while (current < tokens.length) {
		ast.body.push(walk());
	}

	return ast;
}

//TRAVERSER
function traverser(ast, visitor) {
	//遍历数组
	function traverseArray(array, parent) {
		array.forEach((child) => traverseNode(child, parent));
	}

	//遍历节点
	function traverseNode(node, parent) {
		//获取对应的方法
		const method = visitor[node.type];
		//调用对应的方法
		if (method && method.enter) {
			method.enter(node, parent);
		}

		//继续遍历
		switch (node.type) {
			case "Program":
				traverseArray(node.body, node);
				break;
			case "CallExpression":
				traverseArray(node.params, node);
				break;
			case "NumberLiteral":
			case "StringLiteral":
				break;
			default:
				throw new TypeError(node.type);
		}
	}

	//开始遍历
	traverseNode(ast, null);
}

function transformer(ast) {
	const newAst = {
		type: "Program",
		body: [],
	};

	// 因为visitor的内部并没有和newAst建立链接，但和旧的AST的node和parent node都有链接
	// 所以这里可以偷懒，用旧AST的一个字段储存newAst的一个引用，这样就可以通过旧AST来访问和修改newAst了
	ast._context = newAst.body;

	//遍历
	traverser(ast, {
		//定义visitor的方法

		//处理NumberLiteral
		NumberLiteral: {
			enter(node, parent) {
				parent._context.push({
					type: "NumberLiteral",
					value: node.value,
				});
			},
		},

		//处理StringLiteral
		StringLiteral: {
			enter(node, parent) {
				parent._context.push({
					type: "StringLiteral",
					value: node.value,
				});
			},
		},

		//处理CallExpression
		CallExpression: {
			enter(node, parent) {
				//创建一个新的节点，类型为CallExpression
				let expression = {
					type: "CallExpression",
					callee: {
						type: "Identifier",
						name: node.name,
					},
					arguments: [],
				};

				//同样为了方便修改newAst
				node._context = expression.arguments;

				//如果父节点不是CallExpression
				//那么就把父节点包在一个ExpressionStatement节点中
				if (parent.type !== "CallExpression") {
					expression = {
						type: "ExpressionStatement",
						expression: expression,
					};
				}

				//把CallExpression添加到父节点的context中
				parent._context.push(expression);
			},
		},
	});

	return newAst;
}

//CODEGENERATOR
function codeGenerator(node) {
	switch (node.type) {
		//如果是Program，那么就遍历它的body属性，然后用换行符连接每个节点的结果
		case "Program":
			return node.body.map(codeGenerator).join("\n");

		//如果是ExpressionStatement，那么就返回它的expression属性，并且在后面加上分号
		case "ExpressionStatement":
			return codeGenerator(node.expression) + ";";

		//如果是CallExpression，那么就返回它的callee属性，然后添加一个左括号，接着遍历它的arguments属性，用逗号连接每个节点的结果，最后加上一个右括号
		case "CallExpression":
			return (
				codeGenerator(node.callee) +
				"(" +
				node.arguments.map(codeGenerator).join(", ") +
				")"
			);

		//如果是Identifier，那么就返回它的name属性
		case "Identifier":
			return node.name;

		//如果是NumberLiteral，那么就返回它的value属性
		case "NumberLiteral":
			return node.value;

		//如果是StringLiteral，那么就在它的value属性的两边加上双引号
		case "StringLiteral":
			return '"' + node.value + '"';

		//如果没有匹配到，就抛出错误
		default:
			throw new TypeError(node.type);
	}
}

//COMPILER
function compiler(input) {
	const tokens = tokenizer(input);
	const ast = parser(tokens);
	const newAst = transformer(ast);

	return codeGenerator(newAst);
}

// TEST
console.log(compiler('(add 10 (subtract 20 100)) (connect "Hello" "World")'));
// add(10, subtract(20, 100));
// connect("Hello", "World");
