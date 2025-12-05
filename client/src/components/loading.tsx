interface LoadingProps {
  fullScreen?: boolean;
}

function Loading({ fullScreen = false }: LoadingProps) {
  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    ...(fullScreen && {
      minHeight: '100vh',
      backgroundColor: 'white',
    }),
    ...(!fullScreen && {
      padding: '3rem',
    }),
  };

  return (
    <div style={style}>
      <div>Loading...</div>
    </div>
  );
}

export default Loading;
