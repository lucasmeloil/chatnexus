import * as React from "react";

declare global {
  namespace JSX {
    type ElementType =
      | keyof IntrinsicElements
      | ((props: any, context?: any) => React.ReactNode)
      | { (props: any, ...args: any[]): React.ReactNode }
      | (new (props: any) => React.Component<any, any>)
      | React.JSX.ElementType;

    interface Element extends React.ReactElement<any, any> {}
    interface ElementClass extends React.JSX.ElementClass {}
    interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
    type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
    interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  }
}

declare module "react/jsx-runtime" {
  export namespace JSX {
    type ElementType = globalThis.JSX.ElementType;
    interface Element extends globalThis.JSX.Element {}
    interface ElementClass extends globalThis.JSX.ElementClass {}
    interface ElementAttributesProperty extends globalThis.JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends globalThis.JSX.ElementChildrenAttribute {}
    type LibraryManagedAttributes<C, P> = globalThis.JSX.LibraryManagedAttributes<C, P>;
    interface IntrinsicAttributes extends globalThis.JSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends globalThis.JSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends globalThis.JSX.IntrinsicElements {}
  }
}

declare module "react/jsx-dev-runtime" {
  export namespace JSX {
    type ElementType = globalThis.JSX.ElementType;
    interface Element extends globalThis.JSX.Element {}
    interface ElementClass extends globalThis.JSX.ElementClass {}
    interface ElementAttributesProperty extends globalThis.JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends globalThis.JSX.ElementChildrenAttribute {}
    type LibraryManagedAttributes<C, P> = globalThis.JSX.LibraryManagedAttributes<C, P>;
    interface IntrinsicAttributes extends globalThis.JSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends globalThis.JSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends globalThis.JSX.IntrinsicElements {}
  }
}
