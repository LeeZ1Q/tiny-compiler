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
    if(method && method.enter){
      method.enter(node, parent);
    }

    //继续遍历
    switch(node.type){
      case 'Program':
        traverseArray(node.body, node);
        break;
      case 'CallExpression':
        traverseArray(node.params, node);
        break;
      case 'NumberLiteral':
      case 'StringLiteral':
        break;
      default:
        throw new TypeError(node.type);
    }
	}

	//开始遍历
	traverseNode(ast, null);
}
