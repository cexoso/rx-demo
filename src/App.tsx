import React, { useRef, useState, useEffect } from "react";
import { BehaviorSubject, Observable, from } from "rxjs";
import { switchMap, map, startWith, delay } from "rxjs/operators";
import "./App.css";
import classnames from "classnames";
import axios from "axios";

function useConstant<T>(creator: () => T) {
  const ref = useRef<T>();
  if (!ref.current) {
    ref.current = creator();
  }
  return ref.current;
}
function useObservable<T>(observable: Observable<T>) {
  const [state, setState] = useState<T | undefined>(() => {
    let initValueIfHas: T | undefined = undefined;
    const subscribe = observable.subscribe((initValue) => {
      initValueIfHas = initValue;
    });
    subscribe.unsubscribe();
    // 同步获取初始化的值
    return initValueIfHas;
  });
  useEffect(() => {
    const subscribe = observable.subscribe((next) => {
      setState(next);
    });
    return () => {
      subscribe.unsubscribe();
    };
  }, [observable]);
  return state;
}
interface responseType {
  login: string;
  avatar_url: string;
}

export function RxjsDemo() {
  const names = ["junegunn", "gaearon", "benlesh"];
  const activeName$ = useConstant(() => new BehaviorSubject(names[0]));
  const activeName = useObservable(activeName$);

  const detail$ = useConstant(() => {
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
  const detail = useObservable(detail$);
  const isLoading = detail === undefined || detail.type === "loading";
  return (
    <div className="App">
      <ul className="list">
        {names.map((name) => {
          return (
            <li
              onClick={() => {
                activeName$.next(name);
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

export function NormalDemo() {
  const names = ["junegunn", "gaearon", "benlesh"];
  const [activeName, setActiveName] = useState(names[0]);
  const [detail, setDetail] = useState<responseType | undefined>();
  const [fetchStatue, setFetchStatue] = useState<"loaded" | "loading">(
    "loading"
  );
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
    changeName(activeName);
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
