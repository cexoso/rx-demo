# rxjs demo
体验地址：[https://cexoso.github.io/rx-demo/](https://cexoso.github.io/rx-demo/)
## 引言

本示例是我对 rxjs 作为数据管理的理解，以及我使用 rxjs 的一点心得。同时本示例也附带了使用 react hooks 对接 observable 数据类型的使用方式。

## 正文

在使用 rxjs 之前，我有使用过函数式编程（FP）的学习经历，在学习函数式编程时，有一个函数式编程和指令式编程不同的疑问，之前有一个答案我很赞同：

> 指令式编程要求研发步步考虑到，要一步一步的告诉计算机怎么得到结果。如果说在指令式编程中，研发人员是工作，那在函数式编程中，研发人员就是工程师，函数式程序更像是一张蓝图。描述了系统长什么样，而具体的实现，研发人员是不需要关心的。

这段话对我使用 rxjs 有一个指导作用，使用 rxjs 编程，就要用流式的范式来思考程序的实现，如果使用指令式的思想来指导自己使用 rxjs，会觉得非常的别扭。以下我会使用一个示例，来说明在流式编程中，是怎么构建起来的。

### 示例场景

这个示例场景是这样的：
用户可以访问一个列表，该列表上有一系列的人，用户可以点击其中一个人名，查看该人的详情信息。详情信息是需要使用网络请求从服务器上拉取的。该 demo 使用了 github 的 api，仅仅是因为 github 的 open api 是支持跨域的，用来写演示成本非常的低。

以下示例均使用 react 演示

### 指令式编程

所以让我们来思考指令式编程会怎么做，首先假设我们有一个名字列表

```typescript
function NormalDemo() {
  const names = ["junegunn", "gaearon", "benlesh"];
  // 对于组件来说，需要维护非常多的内部状态，包含当前名字（业务状态）、数据信息（数据状态），加载状态信息（数据状态）
  const [activeName, setActiveName] = useState(names[0]);
  const [detail, setDetail] = useState<responseType | undefined>();
  const [fetchStatue, setFetchStatue] = useState<"loaded" | "loading">(
    "loading"
  );
  // changeName 就是指令式编程的试试，内部关注了怎么发起请求，怎么设置请求中，以及请求返回后设置请求状态为完成，并且还要关注将数据同步到 state 中。
  const changeName = (name: string) => {
    setActiveName(name);
    setFetchStatue("loading");
    axios
      .get<responseType>(`https://api.github.com/users/${name}`)
      .then((payload) => {
        setDetail(payload.data);
      })
      .finally(() => {
        setFetchStatue("loaded");
      });
  };

  useEffect(() => {
    changeName(activeName); // react 组件挂载后进行请求以便第一次渲染出默认的数据
  }, []);

  const isLoading = fetchStatue === "loading";
  return (
    <div className="App">
      <ul className="list">
        {names.map((name) => {
          return (
            <li
              onClick={() => changeName(name)}
              className={classnames("name", {
                active: activeName === name,
              })}
              key={name}
            >
              {name}
            </li>
          );
        })}
      </ul>
      {isLoading && <div>加载中...</div>}
      {!isLoading && (
        <div className="detail">
          name: {(detail as responseType).login}
          <img src={(detail as responseType).avatar_url} />
        </div>
      )}
    </div>
  );
}
```

指令式需要步步都关注到，这代码中，可以继续封装和分层来解决代码杂揉在一起的问题。

### 流式编程

```typescript
export function RxjsDemo() {
  const names = ["junegunn", "gaearon", "benlesh"];
  const activeName$ = useConstant(() => new BehaviorSubject(names[0])); // 名字流
  const activeName = useObservable(activeName$);

  const detail$ = useConstant(() => {
    // detail 信息是名字流到详情流的一个映射，这个 detail$ 仅是描述了映射，并不会真正的发起请求（负作用），请求发起与否，取决 于这个流是否真正的被需求到，下文中的 useObservable 就是真正的读取这个流。
    return activeName$.pipe(
      switchMap((name) => {
        return from(
          axios.get<responseType>(`https://api.github.com/users/${name}`)
        ).pipe(
          delay(1000), // 模拟一秒的网络延时
          map((payload) => {
            console.log("debugger payload", payload);
            return {
              type: "loaded" as const,
              payload,
            };
          }),
          startWith({
            type: "loading" as const,
          })
        );
      })
    );
  });
  const detail = useObservable(detail$); // 以下是使用 detail 渲染
  const isLoading = detail === undefined || detail.type === "loading";
  return (
    <div className="App">
      <ul className="list">
        {names.map((name) => {
          return (
            <li
              onClick={() => {
                activeName$.next(name); // 这里没有关注到细节，点击动作仅仅是改变了当前的名字。
              }}
              className={classnames("name", {
                active: activeName === name,
              })}
              key={name}
            >
              {name}
            </li>
          );
        })}
      </ul>
      {isLoading && <div>加载中...</div>}
      {!isLoading && (
        <div className="detail">
          name: {detail.payload.data.login}
          <img src={detail.payload.data.avatar_url} />
        </div>
      )}
    </div>
  );
}
```

## demo 中流式与指令式的区分

1. 流式编程关注的是数据的流转，从 activeName$ 到 detail$ 的映射规则。对于上层使用，react 是无须关注数据获取的细节的，数据获取的细节对应到了数据流的映射中了。而使用指令式编程，react 层是需要关注到数据获取的细节的。
2. 其实，如果你有过相关的经历，你会发现，使用指令式编程的 demo 存在一个 bug，请求竞态问题。假如用户快速的点击了两个人名，如果先点击的人名信息后返回，这可能造成数据显示上的错误，详情对应的人名错了。而要解决这个问题，指令式编程通常需要关注到上一次的请求，在本次请求的时候停止上一次请求的处理。或者加判断，请求返回值的 用户 id 是否与请求的 id 对应，如果不对应上就不再 setState。但在流式编程中，这个操作被抽象成了 switchMap，switchMap 保证了数据流总是映射到最后一个流中的。这个例子想讲明白的是，流式编程中，我们关注的是流的转换（或者说映射），而不是针对数据获取的细节来实现目标。

## 关于 rxjs 的一些看法

在 demo 中演示的不是特别的强烈，所以我觉得我有必要再强调一些我觉得比较重要的点：

1. 尽量把 rxjs 看作是数据结构和操作符（转换）的集合。不要把 rxjs 当成 加强版的 Promise 使用。例如:

```typescript
// bad case
// 当你想获取一个数据的时候，你可能会想，我定义一个方法。
function getUser(user_id) {
  return user$;
}
// 并且在渲染实例中通过 id 去获取 user 信息
getUser("mock_id").subscribe(() => {
  // do somethien
});

// good case

// 与其定义怎么获取到某一个用户的信息。不如一定用户的信息流
const user$ = user_id$.pipe(); // 这个用户的信息与 user_id 有关。

user$.subscribe(() => {
  // do somethien
});
```

示例中，直接定义 user$ 数据的做法就是把 rxjs 当成了数据结构。而 getUser 的做法是将 rxjs 当成了加强版本的 Promise。并不是说 rxjs 不能处理单次请求，而是我们优先使用数据定义的方式来思考构建应用，更符合流式构建的做法。这也引出了下一点结论。

2. 总是在最大的 scope 内定义流。在上一个示例中，在 getUser 函数中定义了 `user$` 信息，这个 scope 是 function 内的，相比之下，直接定义 `user$` 使用就是比 getUser 更大的 scope 了。
